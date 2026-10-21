// The traffic drivers' limits (the Intelligent Driver Model in Traffic.ts), on their own so the pure-logic modules
// that must plan around the traffic (the OC Hypercar's Thrust Hop, HyperAbility.ts) read the same numbers without
// pulling in three.js. No allocation, no imports.
export const IDM = {
  accel: 1.6,          // m/s²: the most a driver speeds up by
  boldAccel: 1.4,      // × accel for an aggressive driver (Expert traffic)
  comfort: 3.2,        // m/s²: the braking a driver plans for (the model's b)
  maxBrake: 10,        // m/s²: the hardest any driver brakes (the model's clamp: an emergency stop)
  stopBrake: 4,        // m/s²: at least this when a driver has been hit and stops
};
