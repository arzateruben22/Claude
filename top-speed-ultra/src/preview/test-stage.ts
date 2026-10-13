// The "before" picture: the game as it is today (its roads, terrain, sky, car and hands), from the driver's seat on
// the preview's stretch of the 405. ?s=metres from the stretch start, ?time=sunset|day|..., ?view=seat|chase
import { makeStage } from './stage';
import { PlayerCar } from '../game/vehicle/PlayerCar';

const q = new URLSearchParams(location.search);
const stage = await makeStage();
const st = stage.stretch!;
const s = st.s0 + Number(q.get('s') ?? 1500);
stage.useGameSky((q.get('time') as 'sunset') ?? 'sunset');
const frame = stage.driverView(s);
const car = new PlayerCar();
frame.add(car.root);
if (q.get('view') === 'chase') {
  const back = stage.roadPoint(s - 9, st.path.laneCenter(1)).p;
  stage.camera.position.set(back.x, back.y + 2.6, back.z);
  stage.camera.lookAt(frame.position.x, frame.position.y + 1, frame.position.z);
}
stage.addGameWorld('high');
await stage.ready(4);
