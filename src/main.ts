import { Game } from './game/Game';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const overlay = document.getElementById('ui-overlay') as HTMLElement;

if (!canvas || !overlay) {
  throw new Error('Required DOM elements not found');
}

const game = new Game(canvas, overlay);
game.start();

console.log('%c APEX TUNER ', 'background:#00e5ff;color:#000;font-size:16px;font-weight:bold');
console.log('高拟真赛车调校模拟 — 按 T 打开调校面板');
