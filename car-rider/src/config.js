// Central tuning constants. Distances are metres, times are seconds.

export const ROAD = {
  DS: 1,                 // spacing of centerline samples (arc length)
  CP_STEP: 20,           // spacing of Catmull-Rom control points
  CAPACITY: 2048,        // ring buffer of samples
  CHUNK_LEN: 50,         // length of one road chunk mesh
  CHUNKS_AHEAD: 11,      // how many chunks are kept ahead of the player
  CHUNKS_BEHIND: 2,
  HALF_WIDTH: 5,         // asphalt half width
  SHOULDER: 7.4,         // outer edge of the shoulder
  RAIL: 7.7,             // guardrail offset
  VERGE: 8.8,            // flat grass strip outside the rail
  LANES: 3,
  LANE_W: 10 / 3,
  GROUND_Y: -0.8,        // height of the flat countryside plane
};

export const PHYS = {
  GRAVITY: 17,
  HOP_V: 6.4,
  START_SPEED: 21,       // m/s (~76 km/h)
  SPEED_GAIN: 19,        // extra m/s approached over a long run
  SPEED_TAU: 130,        // time constant of the speed ramp
  RAIL_CRASH_ANGLE: 0.4, // rad; hitting the rail steeper than this crashes
  MAX_YAW: 0.62,
  SHOULDER_SPEED: 0.62,  // fraction of target speed allowed on the shoulder
  DRIFT: 0.075,          // how strongly bends push the car outward
  RAMP_BONUS: 4.5,       // extra launch velocity off a ramp
};

export const SCORE = {
  COIN: 25,
  TRICK: 300,
  CRUSH: 15,
  MULT_TIME: 5,
  MULT_MAX: 10,
};

export const POWER = {
  NITRO: 3.2,
  NITRO_BOOST: 0.45,
  SHIELD: 15,
  MAGNET: 9,
  GRIP: 10,
  MAGNET_RADIUS: 13,
};

export const LANE_CENTERS = [-ROAD.LANE_W, 0, ROAD.LANE_W];
