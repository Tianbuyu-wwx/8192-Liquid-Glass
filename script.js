// 游戏模型 - 负责核心游戏逻辑
class GameModel {
  constructor() {
    this.grid = [];
    this.score = 0;
    this.best = +localStorage.getItem("zuihao") || 0;
    this.won = false;
    this.over = false;
    this.idCounter = 0;
    this.history = [];
    this.difficulty = 'normal';
    this.steps = 0;
    this.reset();
  }

  reset() {
    this.grid = Array.from({ length: 4 }, () => Array(4).fill(null));
    this.score = 0;
    this.steps = 0;
    this.won = false;
    this.over = false;
    this.addRandom();
    this.addRandom();
    this.history = [];
  }

  // 在随机空位生成一个数字（根据难度调整概率）
  addRandom() {
    const empties = [];

    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        if (this.grid[i][j] == null) empties.push([i, j]);
      }
    }

    if (!empties.length) return;

    const [row, col] = empties[Math.floor(Math.random() * empties.length)];
    
    // 根据难度调整生成概率
    let twoProbability = 0.9; // 默认90%概率生成2
    if (this.difficulty === 'easy') twoProbability = 1;
    else if (this.difficulty === 'hard') twoProbability = 0.8;
    
    this.grid[row][col] = {
      value: Math.random() < twoProbability ? 2 : 4,
      id: ++this.idCounter,
    };
  }

  // 保存游戏状态到历史记录
  saveState() {
    // 优化：使用深度克隆替代JSON序列化
    const clonedGrid = this.deepCloneGrid();
    this.history.push({
      grid: clonedGrid,
      score: this.score,
      steps: this.steps,
      idCounter: this.idCounter,
      won: this.won,
      over: this.over
    });
    
    // 限制历史记录长度
    if (this.history.length > 10) {
      this.history.shift();
    }
  }

  // 深度克隆网格数据
  deepCloneGrid() {
    const cloned = Array(4).fill().map(() => Array(4).fill(null));
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (this.grid[r][c]) {
          cloned[r][c] = { ...this.grid[r][c] };
        }
      }
    }
    return cloned;
  }

  // 撤销上一步操作
  undo(prevState) {
    this.grid = prevState.grid;
    this.score = prevState.score;
    this.steps = prevState.steps;
    this.idCounter = prevState.idCounter;
    this.won = prevState.won;
    this.over = prevState.over;
  }

  // 根据方向移动棋盘
  move(dir) {
    const beforeGrid = this.deepCloneGrid();
    let hasChanged = false;
    let hasMerge = false;

    switch (dir) {
      case "left":
        this.grid = this.grid.map((row) => {
          const result = this.slide(row);
          if (result.merge) hasMerge = true;
          return result.row;
        });
        break;
      case "right":
        this.grid = this.grid.map((row) => {
          const result = this.slide(row.reverse());
          if (result.merge) hasMerge = true;
          return result.row.reverse();
        });
        break;
      case "up":
        this.transpose();
        this.grid = this.grid.map((row) => {
          const result = this.slide(row);
          if (result.merge) hasMerge = true;
          return result.row;
        });
        this.transpose();
        break;
      case "down":
        this.transpose();
        this.grid = this.grid.map((row) => {
          const result = this.slide(row.reverse());
          if (result.merge) hasMerge = true;
          return result.row.reverse();
        });
        this.transpose();
        break;
    }

    // 检查是否有变化
    for (let r = 0; r < 4 && !hasChanged; r++) {
      for (let c = 0; c < 4; c++) {
        if (!this.grid[r][c] && beforeGrid[r][c] || 
            this.grid[r][c] && !beforeGrid[r][c] ||
            (this.grid[r][c] && beforeGrid[r][c] && this.grid[r][c].value !== beforeGrid[r][c].value)) {
          hasChanged = true;
          break;
        }
      }
    }

    return { hasChanged, hasMerge };
  }

  // 将一行（或一列）数字向左合并并补齐空位
  slide(row) {
    row = row.filter((cell) => cell);
    let hasMerge = false;
    for (let i = 0; i < row.length - 1; i++) {
      if (row[i].value === row[i + 1].value) {
        row[i].value *= 2;
        this.score += row[i].value;
        row.splice(i + 1, 1);
        hasMerge = true;
      }
    }
    while (row.length < 4) row.push(null);
    return { row, merge: hasMerge };
  }

  // 设置游戏难度
  setDifficulty(difficulty) {
    this.difficulty = difficulty;
    this.reset();
  }

  // 矩阵求转置（行列互换）
  transpose() {
    this.grid = this.grid[0].map((_, i) => this.grid.map((row) => row[i]));
  }

  movesAvailable() {
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (this.grid[r][c] == null) return true;

        const val = this.grid[r][c].value;

        if (r < 3 && this.grid[r + 1][c] && this.grid[r + 1][c].value === val)
          return true;
        if (c < 3 && this.grid[r][c + 1] && this.grid[r][c + 1].value === val)
          return true;
      }
    }

    return false;
  }

  checkStatus() {
    const reachedGoal = this.grid.flat().some((t) => t && t.value === 8192);

    if (reachedGoal && !this.won) {
      this.won = true;
      return { status: 'won', message: '获得成就 “天才少年”' };
    }

    if (!this.movesAvailable()) {
      this.over = true;
      return { status: 'over', message: '菜就多练' };
    }

    return null;
  }
}

// 游戏视图 - 负责UI渲染和用户交互
class GameView {
  constructor(model, controller) {
    this.model = model;
    this.controller = controller;
    this.tileEls = new Map();
    this.boardEl = document.querySelector(".board");
    this.cellEls = [];
    this.init();
  }

  init() {
    this.buildGrid();
    this.attachEvents();
    this.render();
    this.updateScores();
  }

  buildGrid() {
    const gridEl = document.querySelector(".grid");
    gridEl.innerHTML = "";

    for (let i = 0; i < 16; i++) {
      gridEl.insertAdjacentHTML("beforeend", "<div class='cell'></div>");
    }
    this.cellEls = Array.from(document.querySelectorAll(".grid .cell"));
  }

  attachEvents() {
    document.addEventListener("keydown", (e) => {
      const dirs = {
        ArrowUp: "up",
        ArrowDown: "down",
        ArrowLeft: "left",
        ArrowRight: "right",
        w: "up",
        s: "down",
        a: "left",
        d: "right",
      };

      if (dirs[e.key]) {
        e.preventDefault();
        this.controller.handleMove(dirs[e.key]);
      } else if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.controller.handleUndo();
      }
    });
  }

  render() {
    if (!this.cellEls.length) return;

    // 当前 step 存活的 id，用于判定哪些 DOM 需要删除
    const aliveIds = new Set();

    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const tile = this.model.grid[r][c];
        if (!tile) continue;

        aliveIds.add(tile.id);

        let el = this.tileEls.get(tile.id);

        // 定位目标 cell
        const cellEl = this.cellEls[4 * r + c];
        const left = cellEl.offsetLeft + "px";
        const top = cellEl.offsetTop + "px";

        if (el) {
          // 若数字变化则更新 class 与文本
          if (!el.classList.contains(`tile-${tile.value}`)) {
            el.className = `tile tile-${tile.value}`;
            el.textContent = tile.value;
          }

          // 更新位置
          el.style.left = left;
          el.style.top = top;
        } else {
          el = document.createElement("div");
          el.className = `tile tile-${tile.value}`;
          el.textContent = tile.value;
          el.style.left = left;
          el.style.top = top;

          this.boardEl.appendChild(el);
          this.tileEls.set(tile.id, el);

          el.style.transform = "scale(0)";
          requestAnimationFrame(() => {
            el.style.transform = "scale(1)";
          });
        }
      }
    }

    // 批量处理DOM更新
    this.removeOldTiles(aliveIds);
  }

  // 批量删除已不存在的DOM元素
  removeOldTiles(aliveIds) {
    const tilesToRemove = [];
    
    // 先收集所有需要删除的元素
    this.tileEls.forEach((el, id) => {
      if (!aliveIds.has(id)) {
        tilesToRemove.push({ el, id });
      }
    });
    
    // 然后统一处理动画和删除
    tilesToRemove.forEach(({ el, id }) => {
      el.style.transform = "scale(0)";
      setTimeout(() => el.remove(), 150);
      this.tileEls.delete(id);
    });
  }

  // 清空所有方块DOM元素
  clearTilesDom() {
    this.tileEls.forEach((el) => el.remove());
    this.tileEls.clear();
  }

  // 更新分数显示
  updateScores() {
    document.getElementById("score").textContent = this.model.score;

    if (this.model.score > this.model.best) {
      this.model.best = this.model.score;
      localStorage.setItem("zuihao", this.model.best);
    }

    document.getElementById("best").textContent = this.model.best;
    document.getElementById("steps").textContent = this.model.steps;
  }

  // 播放音效
  playSound(type) {
    const sound = document.getElementById(`${type}-sound`);
    if (sound) {
      sound.currentTime = 0;
      sound.play().catch(e => console.log('Sound play error:', e));
    }
  }

  /**
   * 根据类型展示蒙层
   * @param {string} type - 蒙层类型 'won' 或 'over'
   * @param {string} message - 显示的消息
   */
  showOverlay(type, message) {
    const overlayEl = document.getElementById(type === "won" ? "won" : "over");
    if (!overlayEl) return;

    // 创建包含游戏统计信息的HTML内容
    const statsHtml = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%;">
        <div style="font-size: 40px; margin-bottom: 30px;">${message}</div>
        <div style="font-size: 20px; margin-bottom: 10px;">本局分数: ${this.model.score}</div>
        <div style="font-size: 20px; margin-bottom: 10px;">步数: ${this.model.steps}</div>
        <div style="font-size: 20px; margin-bottom: 30px;">最高分: ${this.model.best}</div>
        <div style="font-size: 16px; opacity: 0.7;">点击任意位置继续</div>
      </div>
    `;

    overlayEl.innerHTML = statsHtml;
    overlayEl.style.display = "flex";
    overlayEl.style.color = "#fff";
    overlayEl.style.cursor = "pointer";

    overlayEl.onclick = () => {
      overlayEl.style.display = "none";
      if (type !== "won") {
        this.controller.handleReset();
      }
    };
  }
}

// 游戏控制器 - 负责业务逻辑和模型视图的连接
class GameController {
  constructor() {
    this.model = new GameModel();
    this.view = new GameView(this.model, this);
  }

  // 处理移动操作
  handleMove(dir) {
    // 保存当前状态到历史记录
    this.model.saveState();
    
    const { hasChanged, hasMerge } = this.model.move(dir);

    if (hasChanged) {
      // 播放音效
      this.view.playSound('move');
      if (hasMerge) {
        this.view.playSound('merge');
      }
      
      this.model.steps++;
      this.model.addRandom();
      this.view.render();
      this.view.updateScores();
      
      const status = this.model.checkStatus();
      if (status) {
        this.view.playSound(status.status);
        this.view.showOverlay(status.status, status.message);
      }
    }
  }

  // 处理撤销操作
  handleUndo() {
    if (this.model.history.length === 0) return;
    
    const prevState = this.model.history.pop();
    this.model.undo(prevState);
    
    this.view.render();
    this.view.updateScores();
    this.view.playSound('move');
  }

  // 处理重置操作
  handleReset() {
    this.view.clearTilesDom();
    this.model.reset();
    this.view.render();
    this.view.updateScores();
  }

  // 处理难度设置
  handleDifficultyChange(difficulty) {
    this.model.setDifficulty(difficulty);
    this.view.clearTilesDom();
    this.view.render();
    this.view.updateScores();
  }
}

// 主游戏类，提供统一接口
class Yang8192 {
  constructor() {
    this.controller = new GameController();
    this.model = this.controller.model;
    this.view = this.controller.view;
  }

  // 暴露API接口
  reset() {
    this.controller.handleReset();
  }

  undo() {
    this.controller.handleUndo();
  }

  move(dir) {
    this.controller.handleMove(dir);
  }

  setDifficulty(difficulty) {
    this.controller.handleDifficultyChange(difficulty);
  }

  // 其他需要暴露的方法
  get score() { return this.model.score; }
  get best() { return this.model.best; }
  get steps() { return this.model.steps; }
  get won() { return this.model.won; }
  get over() { return this.model.over; }
  get grid() { return this.model.grid; }

  // 提供其他需要的方法访问
}

// 程序入口
document.addEventListener("DOMContentLoaded", () => {
  window.game = new Yang8192();
  document.getElementById("new").onclick = () => window.game.reset();
  
  // 添加撤销按钮
  const controls = document.querySelector('.controls');
  const undoButton = document.createElement('button');
  undoButton.id = 'undo';
  undoButton.textContent = '撤销 (Ctrl+Z)';
  controls.appendChild(undoButton);
  
  undoButton.addEventListener('click', () => {
    window.game.undo();
  });
  
  // 添加难度选择事件监听
  const difficultySelect = document.getElementById('difficulty');
  if (difficultySelect) {
    difficultySelect.addEventListener('change', (e) => {
      window.game.setDifficulty(e.target.value);
    });
  }
});