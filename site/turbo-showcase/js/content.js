export const HERO = {
  eyebrow: 'STRATA T64 · Ball-bearing turbocharger',
  title: 'Exhaust in.<br> Boost out.',
  lede: 'A ball-bearing turbocharger built for fast spool and strong flow. Scroll to inspect every part inside.',
  stats: [['62', 'mm', 'Compressor inducer'], ['150k', 'rpm', 'Max shaft speed'], ['28', 'psi', 'Peak boost'], ['680', 'hp', 'Flow capacity']],
};

export const TEARDOWN = { 
  eyebrow: '01 · Teardown', 
  title: 'Inside the T64', 
  body: 'Nine parts make up the T64. One shaft links the compressor and turbine wheels. A dual ceramic ball-bearing cartridge supports it inside the water-cooled cast-iron centre housing.' 
};

export const OVERVIEW = { 
  eyebrow: '02 · Exploded view', 
  title: 'Component breakdown', 
  body: 'All 9 parts are laid out here. The chapters below examine each one in turn.' 
};

export const OVERVIEW_CALLOUTS = [
  { part: 'compressorHousing', title: 'Compressor housing', text: 'Cast aluminium volute that channels intake air.' },
  { part: 'compressorWheel', title: 'Compressor wheel', text: 'Billet aluminium wheel that compresses intake air.' },
  { part: 'backplate', title: 'Backplate', text: 'Seals and holds the bearing cartridge in place.' },
  { part: 'chra', title: 'Centre housing', text: 'Cast-iron core holding the shaft and bearings.' },
  { part: 'bearing', title: 'Bearing cartridge', text: 'Dual ceramic ball bearings cut shaft friction.' },
  { part: 'shaft', title: 'Drive shaft', text: 'Central shaft linking the turbine and compressor.' },
  { part: 'turbineWheel', title: 'Turbine wheel', text: 'Spins from hot exhaust gas to drive the shaft.' },
  { part: 'turbineHousing', title: 'Turbine housing', text: 'Cast-iron shell that directs exhaust to the wheel.' },
  { part: 'actuator', title: 'Wastegate actuator', text: 'Pneumatic diaphragm that caps boost pressure.' },
];

export const PARTS = [
  { 
    key: 'compressorHousing', 
    name: 'Compressor housing', 
    kicker: 'Air induction', 
    body: 'This cast aluminium housing draws ambient air straight into the wheel. The diffuser and widening volute slow that high-speed air, turning velocity into static boost pressure before it leaves.', 
    specs: [['Material', 'Cast aluminium'], ['Type', 'Volute'], ['Inlet diameter', '62 mm'], ['Outlet diameter', '76 mm']],
    callouts: { 
      inlet: ['Inlet', 'Ambient air enters the housing here.'], 
      shroud: ['Shroud', 'Close-fitting wall that keeps blade tip clearance tight.'], 
      volute: ['Volute', 'Widening spiral that turns air speed into pressure.'], 
      outlet: ['Outlet', 'Compressed air exits here towards the intake.'], 
      diffuser: ['Diffuser', 'Slows air leaving the wheel to build boost pressure.'] 
    } 
  },
  { 
    key: 'compressorWheel', 
    name: 'Compressor wheel', 
    kicker: 'Compression stage', 
    body: 'Machined from one billet of 6061-T6 aluminium, this wheel handles extreme speeds. It uses 6 full blades and 6 splitter blades to move high airflow and resist surge at high RPM.', 
    specs: [['Material', 'Billet aluminium'], ['Inducer', '62 mm'], ['Exducer', '82 mm'], ['Blade count', '6 + 6']],
    callouts: { 
      inducer: ['Inducer', 'Leading edge that pulls incoming air in.'], 
      exducer: ['Exducer', 'Outer rim where air leaves the wheel.'], 
      splitter: ['Splitter', 'Shorter blades that keep the inlet from crowding.'], 
      nut: ['Nut', 'Threads onto the shaft to clamp the wheel.'] 
    } 
  },
  { 
    key: 'chra', 
    name: 'Centre housing', 
    kicker: 'Core assembly', 
    body: 'The cast-iron Centre Housing Rotating Assembly (CHRA) forms the core. Internal water jackets shed heat after shutdown, and a -4 AN oil feed keeps the ceramic bearings cool and oiled.', 
    specs: [['Material', 'Cast Iron'], ['Cooling', 'Water-cooled'], ['Oil feed', '-4 AN'], ['Bearing type', 'Ceramic ball']],
    callouts: { 
      oilIn: ['Oil inlet', 'Feeds oil to the bearing cartridge.'], 
      oilOut: ['Oil outlet', 'Drains oil back to the engine sump.'], 
      coolant: ['Coolant port', 'Circulates coolant to shed exhaust heat.'], 
      shield: ['Heat shield', 'Blocks exhaust heat from reaching the CHRA.'], 
      seal: ['Piston seal', 'Keeps boost and exhaust out of the bearings.'] 
    } 
  },
  { 
    key: 'bearing', 
    name: 'Ball-bearing cartridge', 
    kicker: 'Low friction', 
    body: 'Angular-contact silicon nitride balls run in steel races. Unlike journal bearings, they handle axial thrust directly, so no separate thrust bearing is needed. Friction drops, spool quickens, and shaft speed rises.', 
    specs: [['Ball material', 'Silicon nitride'], ['Friction level', 'Ultra-low'], ['Max RPM', '150,000'], ['Load type', 'Angular-contact']],
    callouts: { 
      balls: ['Ceramic balls', 'Silicon nitride balls built for high speed.'], 
      sleeve: ['Bearing sleeve', 'Steel sleeve that houses the bearing races.'], 
      shaft: ['Shaft', 'Central shaft spinning inside the cartridge.'], 
      thread: ['Thread', 'Threaded shaft nose for the compressor nut.'] 
    } 
  },
  { 
    key: 'turbineWheel', 
    name: 'Turbine wheel', 
    kicker: 'Energy extraction', 
    body: 'Exhaust gas enters this radial-inflow wheel at the outer rim and exits down the centre. Cast from Inconel 713C and friction-welded to the shaft, it turns hot gas speed into shaft torque.', 
    specs: [['Inducer', '68 mm'], ['Exducer', '60 mm'], ['Material', 'Inconel 713C'], ['Attachment', 'Friction-welded']],
    callouts: { 
      inducer: ['Inducer', 'Outer rim where exhaust gas enters.'], 
      exducer: ['Exducer', 'Inner bore where spent gas exits.'], 
      weld: ['Weld', 'Friction-welded joint linking wheel and shaft.'] 
    } 
  },
  { 
    key: 'turbineHousing', 
    name: 'Turbine housing', 
    kicker: 'Exhaust management', 
    body: 'Heavy cast iron holds its shape under intense exhaust heat. Its 0.82 A/R scroll favours mid-to-high-RPM power. A V-band clamp locks it to the CHRA with a tight, heatproof seal.', 
    specs: [['Material', 'Cast Iron'], ['A/R', '0.82'], ['Inlet flange', 'T4 flange'], ['Wastegate', 'Internal']],
    callouts: { 
      inlet: ['Inlet', 'T4 flange where exhaust gas enters.'], 
      volute: ['Volute', 'Spiral passage that aims gas at the wheel.'], 
      shroud: ['Shroud', 'Inner wall that guides gas over the blades.'], 
      outlet: ['Outlet', 'Exit path for spent exhaust gas.'], 
      vband: ['V-band', 'Clamp that locks the housing to the CHRA.'] 
    } 
  },
  { 
    key: 'actuator', 
    name: 'Wastegate', 
    kicker: 'Boost control', 
    body: 'The internal wastegate caps boost pressure. When boost at the nipple beats the 14.5 psi spring, the diaphragm pushes the rod. That swings the flapper open so exhaust bypasses the turbine wheel.', 
    specs: [['Type', 'Internal'], ['Spring pressure', '14.5 psi'], ['Actuation', 'Pneumatic'], ['Control', 'Boost-fed']],
    callouts: { 
      canister: ['Canister', 'Holds the spring and pneumatic diaphragm.'], 
      nipple: ['Nipple', 'Port where boost pressure enters.'], 
      rod: ['Rod', 'Linkage that swings the wastegate flapper.'], 
      wastegate: ['Wastegate', 'Flapper arm that bypasses exhaust gas.'] 
    } 
  },
];

export const HOW = {
  eyebrow: '10 · How it works', 
  title: 'The energy loop', 
  body: 'One continuous loop turns waste exhaust energy into dense, pressurised intake air.',
  steps: [
    { title: 'Exhaust enters turbine', text: 'Fast exhaust gas enters the turbine housing and drives the radial-inflow wheel.' },
    { title: 'Turbine spins shaft', text: 'The turbine wheel turns gas flow into torque, spinning the central shaft at high RPM.' },
    { title: 'Compressor packs air', text: 'The shaft drives the compressor wheel, pulling in ambient air and packing it under pressure.' },
    { title: 'Engine makes power', text: 'Denser air packs more oxygen into each cylinder, making more power and more exhaust. Building that loop causes lag.' },
    { title: 'Wastegate caps boost', text: 'The wastegate bypasses exhaust to hold peak boost. A blow-off valve vents intake pressure when the throttle shuts.' }
  ],
};

export const SPECS = [
  ['Compressor inducer', '62 mm'],
  ['Compressor exducer', '82 mm'],
  ['Turbine inducer', '68 mm'],
  ['Turbine exducer', '60 mm'],
  ['A/R ratio', '0.82'],
  ['Bearing type', 'Dual ceramic ball'],
  ['Max shaft speed', '150,000 rpm'],
  ['Peak boost capacity', '28 psi'],
  ['Flow capacity', '680 hp'],
  ['Cooling method', 'Water-cooled CHRA'],
  ['Wastegate type', 'Internal'],
  ['Spring pressure', '14.5 psi'],
];

export const FOOT = 'This is a fictional product presented as an interactive engineering demonstration.';
