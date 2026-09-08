import { GameMode, GameState } from '../types';

export class MenuUI {
  container: HTMLElement;
  onSelect: (mode: GameMode) => void = () => {};

  constructor(container: HTMLElement) {
    this.container = container;
  }

  show(state: GameState): void {
    this.container.innerHTML = `
      <div class="menu-screen">
        <div class="menu-title">APEX TUNER</div>
        <div class="menu-subtitle">高拟真赛车 · 深度引擎调校模拟</div>
        <div class="menu-buttons">
          <button class="menu-btn" data-mode="practice">
            练习模式
            <span class="btn-desc">自由练习，无计时压力，熟悉赛道与调校</span>
          </button>
          <button class="menu-btn" data-mode="time_trial">
            计时赛
            <span class="btn-desc">单圈挑战，追求最快圈速</span>
          </button>
          <button class="menu-btn" data-mode="championship">
            锦标赛
            <span class="btn-desc">三站系列赛，与 AI 车手争夺冠军</span>
          </button>
          <button class="menu-btn" data-mode="free_tuning">
            自由调校
            <span class="btn-desc">静态 Dyno 测试，实时查看马力扭矩曲线</span>
          </button>
        </div>
        <div class="menu-controls">
          <kbd>W</kbd>/<kbd>↑</kbd> 油门 &nbsp;
          <kbd>S</kbd>/<kbd>↓</kbd> 刹车 &nbsp;
          <kbd>A</kbd>/<kbd>D</kbd> 转向 &nbsp;
          <kbd>Q</kbd>/<kbd>E</kbd> 升降档 &nbsp;
          <kbd>Space</kbd> 手刹 &nbsp;
          <kbd>T</kbd> 调校面板 &nbsp;
          <kbd>Esc</kbd> 暂停
          ${state.championship.points > 0 ? `<br/>锦标赛积分: ${state.championship.points}` : ''}
        </div>
      </div>
    `;

    this.container.querySelectorAll('.menu-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = (btn as HTMLElement).dataset.mode as GameMode;
        this.onSelect(mode);
      });
    });
  }

  hide(): void {
    this.container.innerHTML = '';
  }
}
