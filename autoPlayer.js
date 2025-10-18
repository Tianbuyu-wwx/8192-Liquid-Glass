// 使用 Expectimax + 启发式评估

(function(){// 平滑显示效果与性能优化版本
    const DIRS = ["up","right","down","left"]; // 搜索顺序
    const PROB_2 = 0.9;
    
    // 日志相关功能
    let logsEnabled = true;
    let maxLogEntries = 200; // 最大日志条目数量
    
    // 添加日志条目
    function addLogEntry(info, type = 'info') {
      if (!logsEnabled) return;
      
      const logsContainer = document.getElementById('logs-container');
      const logsContent = document.getElementById('logs-content');
      
      if (!logsContainer || !logsContent) return;
      
      // 获取当前时间
      const now = new Date();
      const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
      
      // 创建日志条目元素
      const logEntry = document.createElement('div');
      logEntry.className = 'log-entry';
      
      // 添加时间戳
      const timeSpan = document.createElement('span');
      timeSpan.className = 'log-time';
      timeSpan.textContent = timeString;
      logEntry.appendChild(timeSpan);
      
      // 添加日志内容
      const infoSpan = document.createElement('span');
      
      if (type === 'decision') {
        infoSpan.className = 'log-decision';
      } else if (type === 'score') {
        infoSpan.className = 'log-score';
      } else {
        infoSpan.className = 'log-info';
      }
      
      infoSpan.textContent = info;
      logEntry.appendChild(infoSpan);
      
      // 添加到日志内容容器
      logsContent.appendChild(logEntry);
      
      // 滚动到底部
      logsContent.scrollTop = logsContent.scrollHeight;
      
      // 限制日志条目数量
      if (logsContent.children.length > maxLogEntries) {
        logsContent.removeChild(logsContent.firstChild);
      }
    }
    
    // 显示日志窗口
    function showLogsContainer() {
      const logsContainer = document.getElementById('logs-container');
      if (logsContainer) {
        logsContainer.style.display = 'flex';
      }
    }
    
    // 隐藏日志窗口
    function hideLogsContainer() {
      const logsContainer = document.getElementById('logs-container');
      if (logsContainer) {
        logsContainer.style.display = 'none';
      }
    }
    
    // 清空日志
    function clearLogs() {
      const logsContent = document.getElementById('logs-content');
      if (logsContent) {
        logsContent.innerHTML = '';
      }
      addLogEntry('日志已清空', 'info');
    }
    
    // 初始化日志清空按钮事件监听器
    function initClearLogsButton() {
      const clearLogsBtn = document.getElementById('clear-logs');
      if (clearLogsBtn) {
        clearLogsBtn.addEventListener('click', clearLogs);
      }
    }
    
    // 初始化日志关闭按钮事件监听器
    function initCloseLogsButton() {
      const closeLogsBtn = document.getElementById('close-logs');
      if (closeLogsBtn) {
        closeLogsBtn.addEventListener('click', () => {
          hideLogsContainer();
          addLogEntry('日志窗口已关闭', 'info');
        });
      }
    }
    
    // 优化参数
    let animationDelay = 75; // AI移动的动画延迟时间(ms)
    let maxSearchDepth = 3; // 最大搜索深度
    let performanceMode = false; // 性能模式开关
    
    // 缓存系统 - 避免重复计算
    const cache = new Map();
    const CACHE_SIZE_LIMIT = 5000;
    
    // 动态调整搜索深度的阈值
    const depthThresholds = {
        easy: { emptyTiles: 12, depth: 1 },
        medium: { emptyTiles: 8, depth: 2 },
        hard: { emptyTiles: 4, depth: 3 },
        expert: { emptyTiles: 0, depth: 4 }
    };

    // 深拷贝当前棋盘
    function clone(grid){
        return grid.map(row=>row.map(cell=>cell?{...cell}:null));
    }

    /**
     * 根据给定方向尝试执行一次移动 - 增强版支持动画信息
     * @returns {null | {grid: Array, scoreGain: number, merged: boolean}}
     */
    function tryMove(grid, dir){
        const size=4;
        let moved=false;
        let scoreGain=0;
        let merged = false;
        let newGrid=clone(grid);
        const rotateTimes = {left:0,up:1,right:2,down:3}[dir];
        
        // 旋转以简化处理
        for(let r=0;r<rotateTimes;r++) newGrid = rotateLeft(newGrid);
        
        for(let i=0;i<size;i++){
            const originalRow = newGrid[i].map(c=>c?c.value:0);
            let row = newGrid[i].filter(c=>c);
            
            for(let j=0;j<row.length-1;j++){
                if(row[j].value===row[j+1].value){
                    row[j].value*=2;
                    scoreGain+=row[j].value;
                    row.splice(j+1,1);
                    merged = true;
                }
            }
            
            while(row.length<size) row.push(null);
            const newRowValues = row.map(c=>c?c.value:0);
            
            if(originalRow.some((v,idx)=>v!==newRowValues[idx])) moved = true;
            newGrid[i]=row;
        }
        
        // 旋转回原始方向
        for(let r=0;r<(4-rotateTimes)%4;r++) newGrid = rotateLeft(newGrid);
        return moved?{grid:newGrid,scoreGain,merged}:null;
    }
    
    /**
     * 清理缓存以避免内存泄漏
     */
    function cleanupCache(){
        if(cache.size > CACHE_SIZE_LIMIT){
            // 删除一半的缓存项（最早添加的）
            const keys = Array.from(cache.keys());
            for(let i=0; i<keys.length/2; i++){
                cache.delete(keys[i]);
            }
        }
    }
    
    /**
     * 计算棋盘中的空位数
     */
    function countEmptyTiles(grid){
        let count = 0;
        for(let i=0; i<4; i++){
            for(let j=0; j<4; j++){
                if(!grid[i][j]) count++;
            }
        }
        return count;
    }
    
    /**
     * 根据当前棋盘状态动态调整搜索深度
     */
    function getDynamicDepth(grid){
        if(performanceMode) return 2; // 性能模式下使用较低深度
        
        const emptyTiles = countEmptyTiles(grid);
        
        // 根据空位数量动态调整深度
        if(emptyTiles >= depthThresholds.easy.emptyTiles) return 1;
        if(emptyTiles >= depthThresholds.medium.emptyTiles) return 2;
        if(emptyTiles >= depthThresholds.hard.emptyTiles) return 3;
        return Math.min(4, maxSearchDepth); // 最多使用设置的最大深度
    }
    
    /**
     * 创建棋盘状态的哈希值，用于缓存
     */
    function createGridHash(grid, depth){
        let hash = '';
        for(let i=0; i<4; i++){
            for(let j=0; j<4; j++){
                hash += (grid[i][j]?.value || 0) + ',';
            }
        }
        return hash + depth; // 添加深度以区分不同搜索深度的相同棋盘
    }

    function rotateLeft(mat){
        const n=mat.length;
        const res=Array.from({length:n},()=>Array(n).fill(null));
        for(let i=0;i<n;i++) for(let j=0;j<n;j++) res[n-1-j][i]=mat[i][j];
        return res;
    }

    // 启发式评估函数
    function heuristic(grid){
        let empty=0, monotonic=0, maxTile=0;
        for(let i=0;i<4;i++){
            let prev=0;
            for(let j=0;j<4;j++){
                const cell=grid[i][j];
                if(!cell){empty++;continue;}
                maxTile=Math.max(maxTile,cell.value);
                const v=Math.log2(cell.value);
                if(j>0){monotonic += v - prev;}
                prev=v;
            }
        }
        return empty*1000 + maxTile + monotonic*10;
    }

    // 使用缓存优化的expectimax算法
    function expectimax(grid, depth){
        // 检查缓存
        const hash = createGridHash(grid, depth);
        if(cache.has(hash)){
            return cache.get(hash);
        }
        
        if(depth===0) {
            const result = {score:heuristic(grid)};
            cache.set(hash, result);
            return result;
        }
        
        let bestScore=-Infinity, bestDir=null;
        for(const dir of DIRS){
            const res=tryMove(grid,dir);
            if(!res) continue;
            const {grid:childGrid}=res;
            const expScore = chance(childGrid, depth-1).score;
            if(expScore>bestScore){bestScore=expScore;bestDir=dir;}
        }
        
        const result = {score:bestScore,dir:bestDir};
        cache.set(hash, result);
        cleanupCache(); // 清理缓存以避免内存溢出
        
        return result;
    }

    // 带缓存优化的概率层计算
    function chance(grid, depth){
        // 检查缓存
        const hash = createGridHash(grid, depth);
        if(cache.has(hash)){
            return cache.get(hash);
        }
        
        const empties=[];
        for(let i=0;i<4;i++) for(let j=0;j<4;j++) if(!grid[i][j]) empties.push([i,j]);
        
        if(!empties.length) {
            const result = {score:heuristic(grid)};
            cache.set(hash, result);
            return result;
        }
        
        let total=0;
        // 对每个空位计算可能的值和概率
        for(const [i,j] of empties){
            for(const {value,prob} of [{value:2,prob:PROB_2},{value:4,prob:1-PROB_2}]){
                const g=clone(grid);
                g[i][j]={value};
                total+=prob*expectimax(g,depth).score;
            }
        }
        
        const result = {score:total/empties.length};
        cache.set(hash, result);
        
        return result;
    }

    // 添加决策指示器元素
    function createDecisionIndicator(){
        let indicator = document.getElementById('ai-decision-indicator');
        if(!indicator){
            indicator = document.createElement('div');
            indicator.id = 'ai-decision-indicator';
            indicator.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                z-index: 1000;
                font-size: 2rem;
                font-weight: bold;
                color: rgba(255,255,255,0.7);
                pointer-events: none;
                opacity: 0;
                transition: opacity 0.3s ease;
                text-shadow: 0 0 10px rgba(255,255,255,0.5);
            `;
            document.body.appendChild(indicator);
        }
        return indicator;
    }

    // 显示决策指示器动画
    function showDecisionIndicator(direction){
        const indicator = createDecisionIndicator();
        const dirText = {
            'up': '↑',
            'right': '→',
            'down': '↓',
            'left': '←'
        };
        
        indicator.textContent = dirText[direction] || '';
        indicator.style.opacity = '0.7';
        
        setTimeout(() => {
            indicator.style.opacity = '0';
        }, 300);
    }

    let intervalId=null, running=false;
    let animationFrameId = null; // 用于requestAnimationFrame
    
    // 优化的step函数，支持平滑动画和视觉反馈
    function step(){        
        // 使用requestAnimationFrame确保在浏览器渲染帧中执行
        animationFrameId = requestAnimationFrame(() => {
            if(!window.game || window.game.won || window.game.over){ 
                // 当游戏结束时停止AI
                if(window.game && window.game.over) {
                    addLogEntry('游戏结束: 无法继续移动', 'info');
                }
                stop();
                return;
            }
            
            // 检查是否还有可用移动
            if(window.game.movesAvailable && !window.game.movesAvailable()){
                window.game.over = true;
                window.game.playSound('gameover');
                window.game.showOverlay('over'); // 显示"菜就多练"提示
                addLogEntry('游戏结束: 无法继续移动', 'info');
                stop();
                return;
            }
            
            // 获取动态搜索深度
            const depth = getDynamicDepth(window.game.grid);
            const {dir}=expectimax(window.game.grid, depth);
            
            if(dir) {                
                // 记录决策日志
                const dirText = { 'up': '上', 'right': '右', 'down': '下', 'left': '左' };                
                addLogEntry(`AI 决定: ${dirText[dir]} (搜索深度: ${depth})`, 'decision');
                
                // 显示决策指示器
                showDecisionIndicator(dir);
                
                // 执行移动
                window.game.move(dir);
                
                // 记录分数日志
                if (window.game && window.game.score !== undefined) {
                  addLogEntry(`当前分数: ${window.game.score}`, 'score');
                }
            } else {
                // 当无法找到有效移动时，尝试所有方向并确保正确处理游戏结束状态
            if(!window.game.movesAvailable()){
                window.game.over = true;
                window.game.playSound('gameover');
                window.game.showOverlay('over'); // 显示"菜就多练"提示
                addLogEntry('游戏结束: 无法继续移动', 'info');
                stop();
            } else {
                // 兜底处理 - 尝试所有方向直到找到一个有效的移动
                setTimeout(() => {
                    let moved = false;
                    for(const d of DIRS){
                        if(typeof window.game.move === "function"){
                            const result = window.game.move(d);
                            // 检查是否真的移动成功
                            if(result && result.hasChanged) {
                                moved = true;
                                addLogEntry(`兜底移动: ${d}`, 'decision');
                                break;
                            }
                        }
                    }
                    
                    // 如果尝试了所有方向仍然没有移动，那么游戏确实结束了
                    if(!moved && window.game && !window.game.movesAvailable()){
                        window.game.over = true;
                        window.game.playSound('gameover');
                        window.game.showOverlay('over');
                        addLogEntry('游戏结束: 所有可能的移动都已尝试', 'info');
                        stop();
                    }
                }, 100);
            }
            }
        });
    }

    // 增强版start函数，支持平滑动画和性能优化
    function start(speed=75){
        if(intervalId) return;
        
        // 根据设置更新动画延迟
        animationDelay = speed;
        
        // 显示日志窗口
        showLogsContainer();
        addLogEntry(`AI 开始运行 (速度: ${speed}ms)`, 'info');
        
        // 使用较小的延迟来触发动画帧请求，但实际移动间隔保持不变
        // 这样可以确保动画流畅且不会被跳过
        let lastMoveTime = 0;
        
        function gameLoop(timestamp){
            if(!running) return;
            
            if(!lastMoveTime || timestamp - lastMoveTime >= animationDelay){
                lastMoveTime = timestamp;
                step();
            }
            
            animationFrameId = requestAnimationFrame(gameLoop);
        }
        
        running = true;
        animationFrameId = requestAnimationFrame(gameLoop);
    }

    // 增强版stop函数，确保完全清理资源
    function stop(){        
        if(intervalId){
            clearInterval(intervalId);
            intervalId=null;
        }
        
        if(animationFrameId){
            cancelAnimationFrame(animationFrameId);
            animationFrameId=null;
        }
        
        running=false;
        
        // 清理缓存
        cache.clear();
        
        // 隐藏决策指示器
        const indicator = document.getElementById('ai-decision-indicator');
        if(indicator){
            indicator.style.opacity = '0';
        }
        
        // 重置按钮状态
        const btn = document.getElementById('ai-toggle');
        if(btn){
            btn.textContent = 'AI运行';
        }
        
        // 移除AI运行样式
        toggleAIRunningClass(false);
        
        // 移除自动延迟重置，让用户在点击关闭结束界面后再重置
        // 游戏重置逻辑已移至showOverlay方法中的点击事件处理
        
        // 记录停止日志
        addLogEntry('AI 已停止运行', 'info');
    }

    // 增强版autoPlayer对象，支持配置和优化
    window.autoPlayer={
        start,
        stop,
        isRunning:()=>running,
        
        // 配置方法
        setAnimationDelay: (delay) => { 
            animationDelay = delay;
            // 如果正在运行，重启以应用新的延迟
            if(running) {
                const wasRunning = running;
                stop();
                if(wasRunning) start(animationDelay);
            }
        },
        
        setMaxSearchDepth: (depth) => { 
            maxSearchDepth = Math.max(1, Math.min(5, depth)); // 限制深度在1-5之间
        },
        
        enablePerformanceMode: (enable) => { 
            performanceMode = enable;
        },
        
        // 获取当前状态
        getCurrentSettings: () => ({
            animationDelay,
            maxSearchDepth,
            performanceMode,
            isRunning: running
        })
    };

    // 添加平滑移动和过渡的CSS样式
    function injectSmoothAnimationStyles() {
        // 检查是否已经注入样式
        if (document.getElementById('ai-smooth-animation-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'ai-smooth-animation-styles';
        style.textContent = `
            /* AI决策指示器样式 */
            #ai-decision-indicator {
                animation: pulse 0.6s ease-in-out;
            }
            
            @keyframes pulse {
                0% { transform: translate(-50%, -50%) scale(0.8); opacity: 0; }
                50% { transform: translate(-50%, -50%) scale(1.2); opacity: 0.9; }
                100% { transform: translate(-50%, -50%) scale(1); opacity: 0.7; }
            }
            
            /* 平滑移动和过渡效果 */
            .tile {
                transition: all 0.15s cubic-bezier(0.39, 0.575, 0.565, 1) !important;
            }
            
            /* 提升游戏性能的样式 */
            .board {
                will-change: transform;
                backface-visibility: hidden;
                perspective: 1000px;
            }
            
            /* AI运行时的玻璃效果增强 */
            .game-container.ai-running .glass-effect {
                backdrop-filter: blur(10px) !important;
                transition: backdrop-filter 0.3s ease;
            }
        `;
        
        document.head.appendChild(style);
    }

    // 当AI运行时添加特殊样式类
    function toggleAIRunningClass(isRunning) {
        const gameContainer = document.querySelector('.game-container');
        if (gameContainer) {
            if (isRunning) {
                gameContainer.classList.add('ai-running');
            } else {
                gameContainer.classList.remove('ai-running');
            }
        }
    }

    // 增强的事件监听器，支持性能优化和样式切换
    window.addEventListener('DOMContentLoaded',()=>{
        // 初始化日志相关按钮
        initClearLogsButton();
        initCloseLogsButton();
        // 注入平滑动画样式
        injectSmoothAnimationStyles();
        
        const btn=document.getElementById('ai-toggle');
        if(!btn) return;
        
        // 增强按钮的交互体验
        btn.addEventListener('click',()=>{
            if(window.autoPlayer.isRunning()){
                stop();
                btn.textContent='AI运行';
                toggleAIRunningClass(false);
            } else {
                // 添加启动动画效果
                btn.classList.add('ai-starting');
                setTimeout(() => {
                    btn.classList.remove('ai-starting');
            }, 300);
            
            start();
            btn.textContent='停止自动';
            toggleAIRunningClass(true);
            }
        });
        
        // 添加按钮的悬停和激活样式
        btn.style.transition = 'all 0.3s ease';
        
        btn.addEventListener('mouseenter', () => {
            if (window.autoPlayer.isRunning()) {
                btn.style.backgroundColor = 'rgba(237, 85, 101, 0.9)';
            } else {
                btn.style.backgroundColor = 'rgba(143, 122, 252, 0.9)';
            }
        });
        
        btn.addEventListener('mouseleave', () => {
            btn.style.backgroundColor = '';
        });
        
        // 移除了窗口失焦时暂停AI的功能，使AI可以在后台继续运行
        // 如果需要限制后台运行，可以取消下面的注释
        /*
        window.addEventListener('blur', () => {
            if (window.autoPlayer.isRunning()) {
                window._autoPlayerWasRunning = true;
                stop();
                addLogEntry('AI 因窗口失焦暂停', 'info');
                if(btn) btn.textContent='AI已暂停';
            }
        });
        
        window.addEventListener('focus', () => {
            if (window._autoPlayerWasRunning) {
                delete window._autoPlayerWasRunning;
                start();
                addLogEntry('AI 因窗口聚焦恢复运行', 'info');
                if(btn) btn.textContent='停止自动';
                toggleAIRunningClass(true);
            }
        });
        */
    });
})();