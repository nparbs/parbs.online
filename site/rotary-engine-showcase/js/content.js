export const PHASES = [
  {
    name: 'Intake', color: '#3b9dff',
    text: 'The flank sweeps past the side intake ports and the chamber grows, drawing in a fresh charge.',
  },
  {
    name: 'Compression', color: '#ffb347',
    text: 'The chamber shrinks as the flank rolls toward the minor axis, squeezing the charge into the rotor recess.',
  },
  {
    name: 'Combustion', color: '#ff4a1c',
    text: 'The leading and trailing plugs fire in sequence. Expanding gas drives the flank, and with it the eccentric lobe, onward.',
  },
  {
    name: 'Exhaust', color: '#a3a9b8',
    text: 'The apex seal uncovers the peripheral exhaust port and the shrinking chamber pushes the spent gas out.',
  },
];

export const PARTS = [
  {
    key: 'rotor', name: 'Rotor', kicker: 'The piston, reimagined',
    body: 'A three-flanked rotor of nodular iron orbits its eccentric lobe. Each flank is a working face: in one turn of the rotor, every flank runs a full intake, compression, power and exhaust cycle. That makes three power strokes per rotor revolution, or one for every turn of the shaft.',
    specs: [['Working flanks', '3'], ['Rotor speed', '⅓ × shaft'], ['Material', 'Nodular cast iron'], ['Internal gear', '51 teeth']],
  },
  {
    key: 'seals', name: 'Apex & corner seals', kicker: 'The piston rings of a rotary',
    body: 'Three spring-loaded apex seals ride the chromed trochoid and keep each chamber sealed from the next. Corner seals join each apex seal to the side seals, which close the gas path across the flat faces. Together they form a continuous ring around every chamber.',
    specs: [['Apex seal thickness', '2 mm'], ['Material', 'Carbon-ceramic composite'], ['Per rotor', '3 apex · 6 corner · 6 side'], ['Tip speed @ redline', '≈ 45 m/s']],
  },
  {
    key: 'housing', name: 'Rotor housing', kicker: 'The epitrochoid',
    body: 'Cast aluminium with a hard-chromed bore, its shape set by the generating radius and the eccentricity. Water jackets surround the bore. The plug bosses sit on the hot side and the peripheral exhaust port sits on the cool side, because in a rotary each stroke always happens in the same place.',
    specs: [['Generating radius R', '105 mm'], ['Eccentricity e', '15 mm'], ['Width', '80 mm'], ['Bore finish', 'Hard chrome']],
  },
  {
    key: 'shaft', name: 'Eccentric shaft', kicker: 'Three lobes, 120° apart',
    body: 'This is the rotary’s crankshaft. Each rotor rides its own eccentric lobe on a plain bearing, and the lobes are phased 120° apart so the rotors take turns. Each rotor fires once per shaft revolution, so the R3 makes a power pulse every 120°. A straight-six fires at the same interval.',
    specs: [['Lobes', '3 @ 120°'], ['Throw (e)', '15 mm'], ['Main journal', 'Ø 43 mm'], ['Rotor journal', 'Ø 74 mm']],
  },
  {
    key: 'gear', name: 'Stationary gear', kicker: 'The 2 : 3 rule',
    body: 'Bolted to the housing, the 34-tooth stationary gear never turns. It meshes with the 51-tooth ring gear inside the rotor, and that 2 : 3 ratio holds the rotor at exactly one-third of shaft speed. This keeps all three apexes on the trochoid at every point of the orbit.',
    specs: [['Teeth', '34 : 51'], ['Ratio', '2 : 3'], ['Duty', 'Rotor phasing · main bearing'], ['Material', 'Case-hardened steel']],
  },
  {
    key: 'ih', name: 'Intermediate housing', kicker: 'Walls between chambers',
    body: 'Nitrided cast-iron plates separate the three rotors and give the side seals a hard, flat surface to run on. Each plate carries side intake ports that the rotor face itself opens and closes. The R3 has no valves, cams or timing belt.',
    specs: [['Count', '2 + front & rear'], ['Material', 'Nitrided cast iron'], ['Intake', 'Side ports, primary + secondary'], ['Valvetrain', 'None']],
  },
  {
    key: 'plugs', name: 'Spark plugs', kicker: 'Leading and trailing',
    body: 'A rotary combustion chamber is long and thin, and one flame front cannot burn it all. Each rotor housing has two plugs that fire in sequence: the leading plug first, then the trailing plug a few degrees later. Between them they burn the whole charge as the flank sweeps past.',
    specs: [['Per rotor', '2'], ['Total', '6'], ['Firing', 'Staged, leading → trailing'], ['Location', 'Minor axis, hot side']],
  },
  {
    key: 'intake', name: 'Intake manifold', kicker: 'Six runners, one plenum',
    body: 'A cast plenum feeds six tuned runners, a primary and a secondary for each rotor, that deliver charge straight to the side ports. The runner length is tuned to the 120° pulse train to give strong mid-range torque without losing top end.',
    specs: [['Runners', '6'], ['Throttle', 'Ø 70 mm single'], ['Plenum volume', '4.2 L'], ['Fuel', 'Port injection, 6 injectors']],
  },
  {
    key: 'exhaust', name: 'Exhaust header', kicker: 'Heat with somewhere to go',
    body: 'Rotary exhaust leaves fast and hot, because the port opens while the gas is still expanding. A 3-into-1 stainless header collects the three evenly spaced pulses, and the pressure wave from each pulse helps pull the next chamber clear.',
    specs: [['Layout', '3-into-1'], ['Material', '321 stainless'], ['Primary', 'Ø 48 mm'], ['Gas temperature', '≈ 950 °C']],
  },
];

export const CHAPTERS = [
  ['Overview', 0], ['Ancillaries', 1], ['Unstack', 2], ['Cycle', 3], ['Teardown', 4], ['Components', 5], ['Specification', 14], ['Installed', 15],
];
