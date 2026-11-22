// Engine state machine for the installed-car demo. Pure state, no audio or DOM:
// main.js feeds it throttle and time, audio.js and cluster.js read from it.
//
// off → (key) sweep → crank → catch (flare) → run (fast idle settling to 900) → stopping → off

export const IDLE_RPM = 900, LIMIT_RPM = 9000, SHIFT_RPM = 8600;
const UP_RATE = 9000, DOWN_RATE = 6000;      // free-rev rpm/s at full throttle / closed throttle
const SWEEP_T = 1.1, CRANK_T = 1.3;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));

export class EngineSim {
  constructor() {
    this.state = 'off';
    this.t = 0;              // time in current state
    this.rpm = 0;
    this.throttle = 0;       // smoothed 0..1
    this.target = 0;         // requested throttle
    this.starter = 0;        // 0..1, starter motor engaged
    this.cut = false;        // ignition cut (limiter)
    this.cutT = 0;
    this.accel = 0;          // rpm/s, smoothed, for torque-reaction rock
    this.heat = 0;           // 0..1 exhaust heat
    this.water = 0;          // 0..1 coolant warm-up (cold → normal)
    this.ignition = false;
    this.sweep = 0;          // 0..1 needle sweep amount (tach shows max(sweep, rpm))
    this.pops = 0;           // >0 while overrun pops are likely
    this.fastIdle = 0;
    this.events = [];        // one-shot cues for audio: 'catch', 'pop', 'cut'
  }
  get running() { return this.state === 'catch' || this.state === 'run'; }
  get on() { return this.state !== 'off'; }

  start() { if (this.state === 'off' || this.state === 'stopping') this.go('sweep'); }
  stop() { if (this.state !== 'off') this.go('stopping'); }
  toggle() { this.on && this.state !== 'stopping' ? this.stop() : this.start(); }
  go(s) { this.state = s; this.t = 0; }

  update(dt) {
    this.t += dt;
    const prev = this.rpm;
    const r = Math.random;
    this.throttle += (this.target - this.throttle) * (1 - Math.exp(-dt * 14));
    this.starter = 0;
    this.ignition = this.state !== 'off';

    switch (this.state) {
      case 'off':
        this.rpm = Math.max(0, this.rpm - 3000 * dt);
        break;
      case 'sweep': {
        // gauge self-test: needle up and back, lamps on
        const k = this.t / SWEEP_T;
        this.sweep = Math.sin(Math.PI * clamp(k));
        if (k >= 1) { this.sweep = 0; this.go('crank'); }
        break;
      }
      case 'crank': {
        this.starter = 1;
        // compression chug: speed dips each time a flank comes up on compression (3 per rev)
        this.rpm = 230 + 55 * Math.sin(this.t * 2 * Math.PI * 11.5) + 20 * (r() - 0.5);
        if (this.t > CRANK_T) { this.go('catch'); this.events.push('catch'); }
        break;
      }
      case 'catch': {
        // flare to ~2,300 then fall into fast idle
        const flare = 2300 * Math.sin(Math.PI * clamp(this.t / 0.9)) ** 0.6;
        this.rpm = Math.max(this.rpm + (1500 - this.rpm) * dt * 3, flare);
        if (this.t > 0.9) { this.fastIdle = 1; this.go('run'); }
        break;
      }
      case 'run': {
        this.fastIdle = Math.max(0, this.fastIdle - dt / 6);
        const idle = IDLE_RPM + 450 * this.fastIdle + 35 * Math.sin(this.t * 2.1) + 25 * (r() - 0.5);
        const goal = idle + (LIMIT_RPM + 400 - idle) * this.throttle ** 1.15;
        if (this.rpm < goal) this.rpm = Math.min(goal, this.rpm + UP_RATE * (0.25 + 0.75 * this.throttle) * dt);
        else this.rpm = Math.max(goal, this.rpm - DOWN_RATE * (1 - 0.6 * this.throttle) * dt);
        // rev limiter: hard cut, bounce
        if (this.cut) {
          this.cutT -= dt;
          this.rpm -= 2600 * dt;
          if (this.cutT <= 0) this.cut = false;
        } else if (this.rpm >= LIMIT_RPM) {
          this.rpm = LIMIT_RPM;
          this.cut = true;
          this.cutT = 0.055 + 0.02 * r();
          this.events.push('cut');
        }
        // overrun pops after a big lift
        if (this.throttle < 0.08 && prev > 4200 && this.target === 0) this.pops = Math.max(this.pops, 0.7);
        if (this.pops > 0) {
          this.pops -= dt;
          if (r() < dt * 9 * clamp(this.rpm / 5000)) this.events.push('pop');
        }
        break;
      }
      case 'stopping':
        this.cut = false;
        this.rpm = Math.max(0, this.rpm - (900 + this.rpm * 1.6) * dt);
        if (this.rpm <= 0) this.go('off');
        break;
    }

    const a = (this.rpm - prev) / Math.max(dt, 1e-4);
    this.accel += (a - this.accel) * (1 - Math.exp(-dt * 8));
    // heat follows rpm and throttle, cools slowly; coolant warms only while running
    const hot = this.running ? 0.12 + 0.88 * (this.rpm / LIMIT_RPM) ** 1.5 * (0.4 + 0.6 * this.throttle) : 0;
    this.heat += (hot - this.heat) * (1 - Math.exp(-dt * (hot > this.heat ? 0.6 : 0.18)));
    if (this.running) this.water = Math.min(1, this.water + dt * 0.02 * (1 + this.rpm / 3000));
  }

  // gauge readings
  get oilPressure() { // 0..1 of a 0..10 bar gauge
    if (!this.running && this.state !== 'stopping') return 0;
    return clamp(0.18 + 0.62 * (this.rpm / 7000) ** 0.7);
  }
  get waterTemp() { return clamp(0.12 + 0.43 * this.water + 0.05 * this.heat); } // 0.5 ≈ mid-gauge
  get tach() { return Math.max(this.rpm, this.sweep * 10000); }
  get lamps() { return this.ignition && !this.running; } // warning lamps lit with ignition on until it runs

  takeEvents() { const e = this.events; this.events = []; return e; }
}
