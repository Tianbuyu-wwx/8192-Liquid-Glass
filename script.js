// 粒子效果系统 - 优化版本
class ParticleSystem {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.canvas.style.position = 'fixed';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.zIndex = '100';
    document.body.appendChild(this.canvas);
    
    this.particles = [];
    this.running = false;
    this.lastTime = 0;
    this.maxParticles = 2000; // 防止粒子过多导致性能问题
    // 添加粒子效果开关状态，默认为关闭
    this.enabled = localStorage.getItem('particle-effects') === 'true' || false;
    this.resize();
    
    // 为每种主题配置单独的粒子效果参数
    this.themeConfigs = {
      default: {
        baseColor: '#ffffff',
        particleColor: '#ffffff',
        shape: 'circle',
        speed: 5,
        gravity: 0.1,
        fadeIn: true,
        rotation: false,
        glowIntensity: 0.5,
        bounce: 0.2
      },
      glass: {
        baseColor: '#f0f0ff',
        particleColor: '#c0c0ff',
        shape: 'circle',
        speed: 4,
        gravity: 0.05,
        fadeIn: true,
        rotation: false,
        glowIntensity: 0.8,
        bounce: 0.3,
        transparency: 0.8
      },
      neon: {
        baseColor: '#00ffff',
        particleColor: '#00ffff',
        shape: 'square',
        speed: 6,
        gravity: 0.15,
        fadeIn: false,
        rotation: true,
        glowIntensity: 1.2,
        bounce: 0.1
      },
      gradient: {
        baseColor: '#ff6b6b',
        particleColor: '#ff6b6b',
        shape: 'star',
        speed: 5.5,
        gravity: 0.08,
        fadeIn: true,
        rotation: true,
        glowIntensity: 1.0,
        bounce: 0.25,
        useRainbow: true
      }
    };
    
    // 防抖处理窗口大小调整
    this.resizeTimeout = null;
    window.addEventListener('resize', () => {
      if (this.resizeTimeout) clearTimeout(this.resizeTimeout);
      this.resizeTimeout = setTimeout(() => this.resize(), 100);
    });
    
    // 获取当前主题，用于适配粒子颜色
    this.currentTheme = this.getCurrentTheme();
    window.addEventListener('themeChanged', (e) => {
      this.currentTheme = e.detail.theme;
    });
  }
  
  getCurrentTheme() {
    // 从body或localStorage获取当前主题
    const bodyClass = document.body.className;
    for (const theme of ['glass', 'neon', 'gradient']) {
      if (bodyClass.includes(`theme-${theme}`)) {
        return theme;
      }
    }
    return 'default';
  }
  
  resize() {
    // 仅在必要时调整canvas大小
    const newWidth = window.innerWidth;
    const newHeight = window.innerHeight;
    
    if (this.canvas.width !== newWidth || this.canvas.height !== newHeight) {
      this.canvas.width = newWidth;
      this.canvas.height = newHeight;
    }
  }
  
  start() {
    if (!this.running) {
      this.running = true;
      this.lastTime = performance.now();
      requestAnimationFrame((time) => this.animate(time));
    }
  }
  
  stop() {
    this.running = false;
  }
  
  // 使用时间间隔优化的动画循环
  animate(currentTime) {
    if (!this.running) return;
    
    // 计算时间差，使粒子运动更平滑
    const deltaTime = (currentTime - this.lastTime) / 16.67; // 归一化到60fps
    this.lastTime = currentTime;
    
    // 清除画布
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // 更新和绘制粒子 - 使用快速循环而非filter
    let particleCount = 0;
    for (let i = 0; i < this.particles.length; i++) {
      const particle = this.particles[i];
      
      // 跳过已死亡的粒子
      if (particle.life <= 0) continue;
      
      // 更新粒子状态，应用时间差
      particle.update(deltaTime);
      
      // 只在粒子可见时绘制
      if (particle.life > 0) {
        particle.draw(this.ctx);
        this.particles[particleCount++] = particle;
      }
    }
    
    // 裁剪数组到实际存活的粒子数量
    this.particles.length = particleCount;
    
    // 当没有粒子时停止动画循环
    if (this.particles.length === 0) {
      this.running = false;
      return;
    }
    
    requestAnimationFrame((time) => this.animate(time));
  }
  
  // 设置粒子效果开关状态
  setEnabled(enabled) {
    this.enabled = enabled;
    localStorage.setItem('particle-effects', enabled);
    
    // 如果关闭且有粒子在运行，清除所有粒子
    if (!enabled && this.running) {
      this.particles = [];
      this.running = false;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }
  
  // 获取粒子效果开关状态
  isEnabled() {
    return this.enabled;
  }
  
  // 优化的粒子发射方法
  emit(options) {
    // 如果粒子效果已关闭，直接返回
    if (!this.enabled) return;
    
    // 如果粒子数量已达上限，减少新发射的粒子数
    const currentCount = this.particles.length;
    const maxAllowed = Math.max(0, this.maxParticles - currentCount);
    
    // 获取主题特定的粒子配置
    const themeConfig = this.getThemeParticleConfig(options);
    
    const { 
      x, y, count = 50, 
      color = themeConfig.color,
      size = 4, 
      spread = Math.PI * 2, 
      life = 60, 
      type = themeConfig.useRainbow ? 'rainbow' : 'default', 
      shape = themeConfig.shape,
      speed = themeConfig.speed,
      gravity = themeConfig.gravity,
      fadeIn = themeConfig.fadeIn,
      rotation = themeConfig.rotation,
      bounce = themeConfig.bounce,
      transparency = 1
    } = themeConfig;
    
    // 根据主题调整颜色
    const themeColor = this.getThemeColor(color, type);
    
    this.start();
    
    // 限制发射粒子数量
    const actualCount = Math.min(count, maxAllowed);
    
    for (let i = 0; i < actualCount; i++) {
      const angle = Math.random() * spread - spread / 2;
      const particleSpeed = (Math.random() * 0.5 + 0.5) * speed;
      
      // 粒子速度变化
      const variation = Math.random() * 0.4 - 0.2;
      const finalSpeed = particleSpeed * (1 + variation);
      
      // 创建粒子对象
      const particle = {
        x: x,
        y: y,
        vx: Math.cos(angle) * finalSpeed,
        vy: Math.sin(angle) * finalSpeed,
        size: size * (Math.random() * 0.6 + 0.7), // 更自然的大小变化
        life: life * (Math.random() * 0.4 + 0.8), // 更自然的生命周期
        maxLife: life,
        color: this.getParticleColor(themeColor, type, i, actualCount),
        gravity: gravity,
        shape: shape,
        rotation: rotation ? Math.random() * Math.PI * 2 : 0,
        rotationSpeed: rotation ? (Math.random() - 0.5) * 0.1 : 0,
        alpha: fadeIn ? 0 : 1,
        alphaTarget: transparency,
        alphaSpeed: fadeIn ? 0.1 : 0,
        sizeOverTime: Math.random() * 0.02 - 0.01, // 大小随时间变化
        bounce: bounce,
        trailLength: Math.random() * 5 + 3, // 拖尾长度
        glowIntensity: this.getThemeConfig().glowIntensity || 0.5 // 主题特定的发光强度
      };
      
      this.particles.push(particle);
    }
  }
  
  // 获取当前主题的配置
  getThemeConfig() {
    return this.themeConfigs[this.currentTheme] || this.themeConfigs.default;
  }
  
  // 根据主题获取基础颜色
  getThemeColor(baseColor, type) {
    const config = this.getThemeConfig();
    
    if (type === 'rainbow' || config.useRainbow) return baseColor;
    
    // 优先使用配置中的颜色
    return config.particleColor || baseColor;
  }
  
  // 根据主题获取完整的粒子配置
  getThemeParticleConfig(options = {}) {
    const config = this.getThemeConfig();
    
    // 合并默认配置、主题配置和用户提供的选项
    return {
      ...{
        color: config.particleColor,
        shape: config.shape,
        speed: config.speed,
        gravity: config.gravity,
        fadeIn: config.fadeIn,
        rotation: config.rotation,
        bounce: config.bounce
      },
      ...config,
      ...options
    };
  }
  
  // 增强的颜色生成方法
  getParticleColor(baseColor, type, index, count) {
    if (type === 'rainbow') {
      const hue = (index / count) * 360 + Math.random() * 30; // 添加随机偏移
      return `hsl(${hue}, 100%, 60%)`; // 更亮的颜色
    } else if (type === 'fire') {
      // 火焰效果颜色渐变
      const intensity = 1 - (index / count);
      return `hsl(${intensity * 60}, 100%, ${50 + intensity * 30}%)`;
    } else if (type === 'gold') {
      // 金色效果带随机变化
      return `hsl(${45 + Math.random() * 10}, 100%, ${70 + Math.random() * 10}%)`;
    }
    
    // 为普通粒子添加随机色调变化
    if (baseColor.startsWith('#')) {
      // 将十六进制转换为RGB
      const r = parseInt(baseColor.slice(1, 3), 16);
      const g = parseInt(baseColor.slice(3, 5), 16);
      const b = parseInt(baseColor.slice(5, 7), 16);
      
      // 添加随机变化
      const variation = (Math.random() - 0.5) * 40;
      const newR = Math.max(0, Math.min(255, r + variation));
      const newG = Math.max(0, Math.min(255, g + variation));
      const newB = Math.max(0, Math.min(255, b + variation));
      
      return `rgb(${Math.round(newR)}, ${Math.round(newG)}, ${Math.round(newB)})`;
    }
    
    return baseColor;
  }
}

// 增强的粒子更新方法
function updateParticle(deltaTime) {
  // 应用速度
  this.x += this.vx * deltaTime;
  this.y += this.vy * deltaTime;
  
  // 应用重力
  this.vy += this.gravity * deltaTime;
  
  // 应用旋转
  if (this.rotationSpeed) {
    this.rotation += this.rotationSpeed * deltaTime;
  }
  
  // 渐入效果
  if (this.alpha < this.alphaTarget) {
    this.alpha += this.alphaSpeed * deltaTime;
    if (this.alpha > this.alphaTarget) this.alpha = this.alphaTarget;
  }
  
  // 大小随时间变化
  this.size += this.sizeOverTime * deltaTime;
  if (this.size < 0.5) this.size = 0.5;
  
  // 更新生命值
  this.life -= deltaTime;
}

// 增强的粒子绘制方法
function drawParticle(ctx) {
  ctx.save();
  
  // 计算透明度
  const baseAlpha = this.life / this.maxLife;
  const finalAlpha = baseAlpha * this.alpha;
  ctx.globalAlpha = finalAlpha;
  
  // 获取发光强度（从主题配置）
  const glowIntensity = this.glowIntensity || 0.5;
  
  // 根据形状绘制粒子
  ctx.translate(this.x, this.y);
  ctx.rotate(this.rotation);
  
  // 添加主题特定的发光效果
  if (glowIntensity > 0) {
    // 应用发光滤镜
    ctx.shadowColor = this.color;
    ctx.shadowBlur = this.size * glowIntensity * 2;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }
  
  // 绘制粒子主体
  ctx.fillStyle = this.color;
  ctx.beginPath();
  
  if (this.shape === 'circle' || this.shape === 'glow') {
    ctx.arc(0, 0, this.size, 0, Math.PI * 2);
  } else if (this.shape === 'square') {
    ctx.rect(-this.size, -this.size, this.size * 2, this.size * 2);
  } else if (this.shape === 'star') {
    // 简化的星形绘制
    const spikes = 5;
    const outerRadius = this.size;
    const innerRadius = this.size * 0.5;
    
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();
  }
  
  // 光晕颜色（更淡）
  const glowColor = this.color.replace('rgb', 'rgba').replace(')', ', 0.2)');
  ctx.fillStyle = glowColor;
  ctx.fill();
  
  // 绘制粒子主体
  ctx.beginPath();
  if (this.shape === 'circle' || this.shape === 'glow') {
    ctx.arc(0, 0, this.size, 0, Math.PI * 2);
  } else if (this.shape === 'square') {
    ctx.rect(-this.size, -this.size, this.size * 2, this.size * 2);
    // 添加边框
    ctx.fillStyle = this.color;
    ctx.fill();
    ctx.strokeStyle = `${this.color}66`;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = this.color;
  } else if (this.shape === 'star') {
    // 简化的星形绘制
    const spikes = 5;
    const outerRadius = this.size;
    const innerRadius = this.size / 2;
    
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();
  } else if (this.shape === 'line') {
    // 线条状粒子（适合高速移动效果）
    const length = this.size * 3;
    ctx.beginPath();
    ctx.moveTo(-length, 0);
    ctx.lineTo(length, 0);
    ctx.lineWidth = this.size / 2;
    ctx.strokeStyle = this.color;
    ctx.stroke();
  }
  
  // 填充主体颜色
  if (this.shape !== 'line') {
    ctx.fillStyle = this.color;
    ctx.fill();
  }
  
  ctx.restore();
}

// 应用增强的方法
Object.assign(Object.prototype, {
  update: updateParticle,
  draw: drawParticle
});

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
    
    // 粒子配置参数 - 集中管理便于调整
    this.particleConfig = {
      merge: {
        baseCount: 30,
        baseSpeed: 6,
        baseLife: 70,
        size: 3
      },
      spawn: {
        baseCount: 15,
        baseSpeed: 3,
        baseLife: 50,
        size: 2
      },
      win: {
        baseCount: 100,
        baseSpeed: 8,
        baseLife: 100,
        size: 4
      },
      // 根据方块数值的特效配置
      valueBased: {
        2048: { count: 50, type: 'gold', shape: 'star' },
        4096: { count: 70, type: 'gold', shape: 'star', rotation: true },
        8192: { count: 100, type: 'rainbow', shape: 'glow', rotation: true }
      }
    };
    
    // 初始化粒子系统
    this.particleSystem = new ParticleSystem();
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
          // 若数字变化则更新 class 与文本，同时应用合并动画
          const wasDifferentValue = !el.classList.contains(`tile-${tile.value}`);
          if (wasDifferentValue) {
            el.className = `tile tile-${tile.value}`;
            el.textContent = tile.value;
            // 添加合并动画类
          el.classList.add('tile-merged');
          
          // 触发合并粒子效果
          this.emitMergeParticles(el, tile.value);
          
          // 动画结束后移除合并动画类
          setTimeout(() => {
            el.classList.remove('tile-merged');
          }, 250);
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
        // 触发新方块生成的粒子效果
        this.emitSpawnParticles(el);
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
  
  // 发射合并粒子效果 - 优化版
  emitMergeParticles(element, value) {
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    
    // 基础配置
    const config = this.particleConfig.merge;
    let { count = config.baseCount, speed = config.baseSpeed, life = config.baseLife, size = config.size } = {};
    let color = '#ffffff';
    let type = 'default';
    let shape = 'circle';
    let rotation = false;
    
    // 根据方块数值应用特效配置
    if (this.particleConfig.valueBased[value]) {
      const valueConfig = this.particleConfig.valueBased[value];
      count = valueConfig.count;
      type = valueConfig.type;
      shape = valueConfig.shape;
      rotation = valueConfig.rotation || false;
      speed = value >= 8192 ? config.baseSpeed * 1.5 : config.baseSpeed * 1.2;
    }
    // 常规方块的颜色渐变
    else if (value >= 1024) {
      count = config.baseCount * 1.2;
      color = '#ff6b6b';
      shape = 'square';
      rotation = true;
      // 获取方块实际颜色
      const computedStyle = window.getComputedStyle(element);
      color = computedStyle.backgroundColor || color;
    }
    else if (value >= 256) {
      count = config.baseCount * 1.1;
      color = '#4ecdc4';
      shape = 'circle';
      // 获取方块实际颜色
      const computedStyle = window.getComputedStyle(element);
      color = computedStyle.backgroundColor || color;
    }
    else {
      // 普通合并使用与方块颜色相近的粒子
      const computedStyle = window.getComputedStyle(element);
      color = computedStyle.backgroundColor || '#ffffff';
    }
    
    // 发射主粒子效果
    this.particleSystem.emit({
      x: x,
      y: y,
      count: count,
      speed: speed,
      color: color,
      size: size,
      life: life,
      type: type,
      shape: shape,
      rotation: rotation,
      gravity: value >= 8192 ? 0.05 : 0.1, // 高数值方块重力更小
      fadeIn: true,
      spread: Math.PI * 2
    });
    
    // 高数值方块额外效果：冲击波
    if (value >= 2048) {
      setTimeout(() => {
        this.particleSystem.emit({
          x: x,
          y: y,
          count: 20,
          speed: speed * 1.5,
          color: color,
          size: size * 0.5,
          life: life * 0.6,
          type: type,
          shape: 'line',
          rotation: false,
          gravity: 0,
          fadeIn: false,
          spread: Math.PI * 2
        });
      }, 30);
    }
  }
  
  // 发射新方块生成的粒子效果 - 优化版
  emitSpawnParticles(element) {
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    
    // 使用配置参数
    const config = this.particleConfig.spawn;
    
    // 内向收缩的粒子，创造凝聚效果
    this.particleSystem.emit({
      x: x,
      y: y,
      count: config.baseCount,
      speed: -config.baseSpeed * 0.8, // 负速度表示向内
      color: '#a8a8a8',
      size: config.size,
      life: config.baseLife,
      spread: Math.PI * 2,
      type: 'default',
      shape: 'circle',
      gravity: -0.05, // 轻微向上
      fadeIn: true
    });
    
    // 轻微的爆发效果作为点缀
    setTimeout(() => {
      this.particleSystem.emit({
        x: x,
        y: y,
        count: 5,
        speed: config.baseSpeed * 0.5,
        color: '#ffffff',
        size: config.size * 1.5,
        life: config.baseLife * 0.7,
        spread: Math.PI * 2,
        type: 'default',
        shape: 'glow',
        gravity: 0,
        fadeIn: false
      });
    }, 20);
  }
  
  // 发射游戏胜利粒子效果 - 优化版
  emitWinParticles() {
    const boardRect = this.boardEl.getBoundingClientRect();
    const centerX = boardRect.left + boardRect.width / 2;
    const centerY = boardRect.top + boardRect.height / 2;
    
    const config = this.particleConfig.win;
    
    // 1. 爆发性的彩虹粒子
    this.particleSystem.emit({
      x: centerX,
      y: centerY,
      count: config.baseCount,
      speed: config.baseSpeed,
      color: '#ffffff',
      size: config.size,
      life: config.baseLife,
      type: 'rainbow',
      shape: 'glow',
      rotation: true,
      gravity: 0.05,
      fadeIn: false,
      spread: Math.PI * 2
    });
    
    // 2. 多层环绕光环效果
    const ringCount = 3;
    const ringDelay = 150;
    
    for (let ring = 0; ring < ringCount; ring++) {
      setTimeout(() => {
        const particleCount = 12 + ring * 4;
        const radius = boardRect.width / 4 + ring * 30;
        const delayBetweenParticles = 30 / particleCount;
        
        for (let i = 0; i < particleCount; i++) {
          const angle = (i / particleCount) * Math.PI * 2;
          const x = centerX + Math.cos(angle) * radius;
          const y = centerY + Math.sin(angle) * radius;
          
          setTimeout(() => {
            // 根据环数决定形状和颜色
            const shapes = ['circle', 'square', 'star'];
            const shape = shapes[ring % shapes.length];
            const types = ['gold', 'default', 'fire'];
            const type = types[ring % types.length];
            const hue = (i / particleCount) * 360;
            
            this.particleSystem.emit({
              x: x,
              y: y,
              count: 15,
              speed: 6 - ring * 1,
              color: `hsl(${hue}, 100%, 50%)`,
              size: 2.5 - ring * 0.3,
              life: 70 - ring * 10,
              spread: Math.PI / 3,
              type: type,
              shape: shape,
              rotation: true,
              gravity: -0.02,
              fadeIn: true
            });
          }, i * delayBetweenParticles);
        }
      }, ring * ringDelay + 200);
    }
    
    // 3. 中心点最终爆发效果
    setTimeout(() => {
      this.particleSystem.emit({
        x: centerX,
        y: centerY,
        count: 80,
        speed: 10,
        color: '#ffd700',
        size: 2,
        life: 60,
        type: 'gold',
        shape: 'star',
        rotation: true,
        gravity: 0,
        fadeIn: false,
        spread: Math.PI * 2
      });
    }, ringCount * ringDelay + 500);
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
        // 游戏胜利时触发胜利粒子效果
        if (status.status === 'won') {
          // 添加延迟以确保消息显示后再出现粒子
          setTimeout(() => {
            this.view.emitWinParticles();
          }, 300);
        }
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
  
  // 音频管理器
const AudioManager = {
  // 初始化音频系统
  init() {
    // 创建音频元素
    this.audio = new Audio('Background Music.mp3');
    this.audio.loop = true;
    this.audio.volume = 0.3;
    
    // 从localStorage获取音乐开关状态，默认为关闭
    this.isEnabled = localStorage.getItem('music-enabled') === 'true';
    
    // 注册用户交互事件以触发音频播放（符合浏览器政策）
    this.registerInteractionEvents();
    
    return this;
  },
  
  // 注册用户交互事件以允许音频播放
  registerInteractionEvents() {
    const handleUserInteraction = () => {
      if (this.isEnabled && this.audio.paused) {
        this.audio.play().catch(e => {
          console.log('音频播放失败:', e);
        });
      }
      
      // 移除事件监听器，避免重复触发
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
    };
    
    // 添加事件监听器
    document.addEventListener('click', handleUserInteraction);
    document.addEventListener('keydown', handleUserInteraction);
  },
  
  // 切换音乐开关状态
  toggle() {
    this.isEnabled = !this.isEnabled;
    this.updateMusicState();
    this.saveState();
    return this.isEnabled;
  },
  
  // 设置音乐开关状态
  setEnabled(enabled) {
    this.isEnabled = enabled;
    this.updateMusicState();
    this.saveState();
    return this.isEnabled;
  },
  
  // 获取音乐开关状态
  getEnabled() {
    return this.isEnabled;
  },
  
  // 更新音乐播放状态
  updateMusicState() {
    if (this.isEnabled && this.audio.paused) {
      this.audio.play().catch(e => {
        console.log('音频播放失败:', e);
      });
    } else if (!this.isEnabled && !this.audio.paused) {
      this.audio.pause();
    }
  },
  
  // 保存设置到localStorage
  saveState() {
    localStorage.setItem('music-enabled', this.isEnabled);
  },
  
  // 设置音量
  setVolume(volume) {
    this.audio.volume = Math.max(0, Math.min(1, volume));
  },
  
  // 获取音量
  getVolume() {
    return this.audio.volume;
  }
};

// 主题管理器
const ThemeManager = {
    themes: [
      { id: 'default', name: '默认主题' },
      { id: 'glass', name: '玻璃效果' },
      { id: 'neon', name: '暗黑霓虹灯' },
      { id: 'gradient', name: '渐变色' }
    ],
    
    // 初始化主题选择器
    init() {
      // 移除旧的主题切换按钮
      const oldToggle = document.getElementById('theme-toggle');
      if (oldToggle) {
        oldToggle.remove();
      }
      
      // 初始化音频管理器
      window.audioManager = AudioManager.init();
      
      // 创建设置容器，包含主题选择器、粒子效果开关和音乐开关
      const themeSelector = document.createElement('div');
      themeSelector.className = 'theme-selector';
      themeSelector.innerHTML = `
        <div class="theme-dropdown">
          <button class="theme-select-button">
            <span id="current-theme">默认主题</span>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M3 4L6 7L9 4" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <div class="theme-options">
            ${this.themes.map(theme => `
              <div class="theme-option" data-theme="${theme.id}">${theme.name}</div>
            `).join('')}
          </div>
        </div>
        <!-- 粒子效果开关 -->
        <div class="particle-toggle">
          <label class="toggle-switch">
            <input type="checkbox" id="particle-effects-toggle">
            <span class="toggle-slider"></span>
          </label>
          <span class="toggle-label">粒子效果</span>
        </div>
        <!-- 背景音乐开关 -->
        <div class="music-toggle">
          <label class="toggle-switch">
            <input type="checkbox" id="music-toggle">
            <span class="toggle-slider"></span>
          </label>
          <span class="toggle-label">背景音乐</span>
        </div>
      `;
      
      document.body.appendChild(themeSelector);
      
      // 设置粒子效果开关的初始状态（默认为关闭）
      const particleToggle = document.getElementById('particle-effects-toggle');
      particleToggle.checked = localStorage.getItem('particle-effects') === 'true' || false;
      
      // 添加粒子效果开关事件监听
      particleToggle.addEventListener('change', function() {
        // 存储开关状态
        localStorage.setItem('particle-effects', this.checked);
        
        // 如果游戏已经初始化，更新粒子系统状态
        if (window.game && window.game.view && window.game.view.particleSystem) {
          window.game.view.particleSystem.setEnabled(this.checked);
        }
      });
      
      // 设置背景音乐开关的初始状态
      const musicToggle = document.getElementById('music-toggle');
      musicToggle.checked = window.audioManager.getEnabled();
      
      // 添加背景音乐开关事件监听
      musicToggle.addEventListener('change', function() {
        window.audioManager.setEnabled(this.checked);
      });
      
      // 添加主题选择器和粒子开关样式
      const style = document.createElement('style');
      style.textContent = `
        .theme-selector {
          position: absolute;
          top: 20px;
          left: 20px;
          z-index: 10;
          display: flex;
          align-items: center;
          gap: 20px;
          flex-wrap: wrap;
        }
        
        .theme-dropdown {
          position: relative;
        }
        
        .theme-select-button {
          padding: 10px 20px;
          border: none;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
          font-weight: 600;
          cursor: pointer;
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .theme-select-button:hover {
          background: rgba(255, 255, 255, 0.15);
          transform: translateY(-2px);
        }
        
        .theme-select-button svg {
          transition: transform 0.2s ease;
        }
        
        .theme-select-button.open svg {
          transform: rotate(180deg);
        }
        
        .theme-options {
          position: absolute;
          top: 100%;
          left: 0;
          margin-top: 8px;
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(15px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 12px;
          box-shadow: 
            0 8px 32px rgba(0, 0, 0, 0.1),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
          display: none;
          overflow: hidden;
          min-width: 180px;
          transition: all 0.3s ease;
        }
        
        .theme-options.show {
          display: block;
        }
        
        .theme-option {
          padding: 12px 20px;
          color: rgba(255, 255, 255, 0.9);
          cursor: pointer;
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
        }
        
        .theme-option:hover {
          background: rgba(255, 255, 255, 0.15);
          color: #fff;
          transform: translateX(5px);
        }
        
        .theme-option.active {
          background: rgba(255, 255, 255, 0.25);
          font-weight: 600;
          color: #fff;
          box-shadow: inset 0 0 10px rgba(255, 255, 255, 0.1);
        }
        
        .theme-option::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
          transition: left 0.5s;
        }
        
        .theme-option:hover::before {
          left: 100%;
        }
        
        /* 粒子效果和背景音乐开关样式 */
        .particle-toggle,
        .music-toggle {
          display: flex;
          align-items: center;
          gap: 10px;
          color: #fff;
          font-weight: 600;
          padding: 8px 12px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          transition: all 0.3s ease;
        }
        
        .particle-toggle:hover,
        .music-toggle:hover {
          background: rgba(255, 255, 255, 0.1);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }
        
        .toggle-switch {
          position: relative;
          display: inline-block;
          width: 56px;
          height: 28px;
        }
        
        .toggle-switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }
        
        .toggle-slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(255, 255, 255, 0.15);
          backdrop-filter: blur(5px);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          border-radius: 34px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);
        }
        
        .toggle-slider:before {
          position: absolute;
          content: "";
          height: 20px;
          width: 20px;
          left: 3px;
          bottom: 3px;
          background: linear-gradient(135deg, #ffffff, #e0e0e0);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          border-radius: 50%;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        }
        
        /* 粒子效果开关选中样式 - 使用蓝色调 */
        .particle-toggle input:checked + .toggle-slider {
          background: linear-gradient(135deg, rgba(135, 206, 255, 0.4), rgba(135, 206, 255, 0.6));
          border-color: rgba(135, 206, 255, 0.8);
          box-shadow: 0 0 15px rgba(135, 206, 255, 0.5), inset 0 2px 4px rgba(0, 0, 0, 0.2);
        }
        
        /* 背景音乐开关选中样式 - 使用紫色调 */
        .music-toggle input:checked + .toggle-slider {
          background: linear-gradient(135deg, rgba(147, 112, 219, 0.4), rgba(147, 112, 219, 0.6));
          border-color: rgba(147, 112, 219, 0.8);
          box-shadow: 0 0 15px rgba(147, 112, 219, 0.5), inset 0 2px 4px rgba(0, 0, 0, 0.2);
        }
        
        input:focus + .toggle-slider {
          box-shadow: 0 0 2px rgba(255, 255, 255, 0.8);
        }
        
        input:checked + .toggle-slider:before {
          transform: translateX(28px);
          background: linear-gradient(135deg, #ffffff, #f0f0f0);
        }
        
        .toggle-label {
          font-size: 14px;
          user-select: none;
          color: white;
        }
        
        /* 响应式调整 */
        @media (max-width: 768px) {
          .theme-selector {
            top: 10px;
            left: 10px;
          }
          
          .theme-select-button {
            padding: 8px 16px;
            font-size: 14px;
          }
        }
      `;
      document.head.appendChild(style);
      
      // 绑定事件
      this.bindEvents();
      
      // 应用保存的主题
      const savedTheme = localStorage.getItem('8192-theme') || 'default';
      this.applyTheme(savedTheme);
    },
    
    // 绑定事件
    bindEvents() {
      const button = document.querySelector('.theme-select-button');
      const options = document.querySelector('.theme-options');
      
      // 切换下拉菜单
      button.addEventListener('click', () => {
        button.classList.toggle('open');
        options.classList.toggle('show');
      });
      
      // 点击主题选项
      document.querySelectorAll('.theme-option').forEach(option => {
        option.addEventListener('click', () => {
          const themeId = option.getAttribute('data-theme');
          this.applyTheme(themeId);
          
          // 关闭下拉菜单
          button.classList.remove('open');
          options.classList.remove('show');
        });
      });
      
      // 点击页面其他地方关闭下拉菜单
      document.addEventListener('click', (e) => {
        if (!e.target.closest('.theme-dropdown')) {
          button.classList.remove('open');
          options.classList.remove('show');
        }
      });
    },
    
    // 应用主题
    applyTheme(themeId) {
      // 移除所有主题类
      document.body.className = document.body.className.replace(/theme-\w+/g, '').trim();
      
      // 添加选中的主题类（除了默认主题）
      if (themeId !== 'default') {
        document.body.classList.add(`theme-${themeId}`);
      }
      
      // 更新当前主题显示
      const currentTheme = this.themes.find(t => t.id === themeId);
      if (currentTheme) {
        document.getElementById('current-theme').textContent = currentTheme.name;
      }
      
      // 更新活动选项样式
      document.querySelectorAll('.theme-option').forEach(option => {
        if (option.getAttribute('data-theme') === themeId) {
          option.classList.add('active');
        } else {
          option.classList.remove('active');
        }
      });
      
      // 保存主题设置
      localStorage.setItem('8192-theme', themeId);
      
      // 触发主题变更事件，让粒子系统可以响应
      const themeEvent = new CustomEvent('themeChanged', {
        detail: { theme: themeId }
      });
      window.dispatchEvent(themeEvent);
      
      // 重新渲染游戏视图
      if (window.game && window.game.view) {
        window.game.view.render();
      }
    }
  };
  
  // 初始化主题管理器
  ThemeManager.init();
});