// 互联网大厂向上管理课程系统交互逻辑
document.addEventListener('DOMContentLoaded', () => {
  const data = window.COURSE_DATA;
  if (!data) return;

  // 状态管理
  const state = {
    selectedMonth: 0, // 0 表示全部，1, 2, 3
    selectedModule: 'ALL',
    searchQuery: '',
    completedWeeks: JSON.parse(localStorage.getItem('upward_completed_weeks') || '[]'),
    activeToolTab: 'quiz', // quiz, leaderTypes, badNews, onePager, refuseDict
    quizAnswers: {},
    quizSubmitted: false
  };

  // DOM 元素缓存
  const el = {
    progressFill: document.getElementById('progress-fill'),
    progressCount: document.getElementById('progress-count'),
    progressPercent: document.getElementById('progress-percent'),
    weeksGrid: document.getElementById('weeks-grid'),
    monthFilterBtns: document.querySelectorAll('.month-filter-btn'),
    moduleFilterContainer: document.getElementById('module-filters'),
    searchInput: document.getElementById('search-input'),
    activeModal: document.getElementById('detail-modal'),
    modalContent: document.getElementById('modal-body'),
    closeModalBtn: document.getElementById('close-modal-btn'),
    toast: document.getElementById('toast')
  };

  // Toast 提示
  function showToast(message, duration = 2500) {
    if (!el.toast) return;
    el.toast.textContent = message;
    el.toast.classList.remove('opacity-0', 'pointer-events-none', 'translate-y-2');
    el.toast.classList.add('opacity-100', 'translate-y-0');
    setTimeout(() => {
      el.toast.classList.remove('opacity-100', 'translate-y-0');
      el.toast.classList.add('opacity-0', 'pointer-events-none', 'translate-y-2');
    }, duration);
  }

  // 复制文本到剪贴板
  window.copyToClipboard = function(text, successMsg = '已复制到剪贴板！') {
    navigator.clipboard.writeText(text).then(() => {
      showToast(successMsg);
    }).catch(() => {
      // 兼容后备方案
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast(successMsg);
    });
  };

  // 更新全局学习进度条
  function updateProgress() {
    const total = data.weeks.length;
    const completed = state.completedWeeks.length;
    const percent = Math.round((completed / total) * 100);

    if (el.progressFill) el.progressFill.style.width = `${percent}%`;
    if (el.progressCount) el.progressCount.textContent = `${completed}/${total}`;
    if (el.progressPercent) el.progressPercent.textContent = `${percent}%`;

    localStorage.setItem('upward_completed_weeks', JSON.stringify(state.completedWeeks));
  }

  // 切换周次打卡状态
  window.toggleWeekCompletion = function(weekId, event) {
    if (event) event.stopPropagation();
    const idx = state.completedWeeks.indexOf(weekId);
    if (idx > -1) {
      state.completedWeeks.splice(idx, 1);
      showToast(`已取消 ${weekId} 的完成标记`);
    } else {
      state.completedWeeks.push(weekId);
      showToast(`🎉 恭喜！${weekId} 学习打卡成功！`);
    }
    updateProgress();
    renderWeeksGrid();
  };

  // 渲染模块筛选按钮
  function renderModuleFilters() {
    if (!el.moduleFilterContainer) return;
    let html = `
      <button class="module-filter-btn px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${state.selectedModule === 'ALL' ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}" data-module="ALL">
        全部模块 (全部)
      </button>
    `;
    data.modules.forEach(m => {
      const active = state.selectedModule === m.id;
      html += `
        <button class="module-filter-btn px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border flex items-center gap-1.5 ${active ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'}" data-module="${m.id}">
          <span class="w-2.5 h-2.5 rounded-full inline-block" style="background-color: ${m.color}"></span>
          ${m.id} ${m.name} (${m.duration})
        </button>
      `;
    });
    el.moduleFilterContainer.innerHTML = html;

    // 绑定事件
    el.moduleFilterContainer.querySelectorAll('.module-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        state.selectedModule = btn.dataset.module;
        renderModuleFilters();
        renderWeeksGrid();
      });
    });
  }

  // 获取模块配置
  function getModule(moduleId) {
    return data.modules.find(m => m.id === moduleId) || {};
  }

  // 渲染12周卡片网格
  function renderWeeksGrid() {
    if (!el.weeksGrid) return;

    // 过滤逻辑
    const filtered = data.weeks.filter(w => {
      const matchMonth = state.selectedMonth === 0 || w.month === state.selectedMonth;
      const matchModule = state.selectedModule === 'ALL' || w.moduleId === state.selectedModule;
      const q = state.searchQuery.trim().toLowerCase();
      const matchSearch = !q || (
        w.id.toLowerCase().includes(q) ||
        w.title.toLowerCase().includes(q) ||
        w.tag.toLowerCase().includes(q) ||
        w.scenario.toLowerCase().includes(q) ||
        w.coreKnowledge.some(k => k.toLowerCase().includes(q))
      );
      return matchMonth && matchModule && matchSearch;
    });

    if (filtered.length === 0) {
      el.weeksGrid.innerHTML = `
        <div class="col-span-full py-16 text-center text-slate-400">
          <svg class="w-12 h-12 mx-auto mb-3 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p class="text-base font-medium">未找到符合条件的周次课程</p>
          <p class="text-xs text-slate-400 mt-1">请尝试清除搜索词或重置筛选条件</p>
        </div>
      `;
      return;
    }

    let html = '';
    filtered.forEach(w => {
      const isCompleted = state.completedWeeks.includes(w.id);
      const mod = getModule(w.moduleId);

      // 卡片徽章与主色
      let badgeStyle = "bg-blue-600 text-white";
      let tagBg = "bg-blue-50 text-blue-700 border-blue-200";
      if (w.tag === "认知破局") {
        badgeStyle = "bg-blue-600 text-white";
        tagBg = "bg-blue-50 text-blue-700 border-blue-200";
      } else if (w.tag === "读懂上级") {
        badgeStyle = "bg-emerald-700 text-white";
        tagBg = "bg-emerald-50 text-emerald-800 border-emerald-200";
      } else if (w.tag === "汇报沟通") {
        badgeStyle = "bg-amber-800 text-white";
        tagBg = "bg-amber-50 text-amber-900 border-amber-200";
      } else if (w.tag === "期望边界") {
        badgeStyle = "bg-orange-800 text-white";
        tagBg = "bg-orange-50 text-orange-900 border-orange-200";
      } else if (w.tag === "价值晋升") {
        badgeStyle = "bg-indigo-700 text-white";
        tagBg = "bg-indigo-50 text-indigo-900 border-indigo-200";
      } else if (w.tag === "综合实战") {
        badgeStyle = "bg-green-700 text-white";
        tagBg = "bg-green-50 text-green-900 border-green-200";
      }

      html += `
        <div class="group relative bg-white rounded-2xl border ${isCompleted ? 'border-emerald-300 shadow-sm' : 'border-slate-200 shadow-sm hover:shadow-md'} hover:border-slate-300 transition-all duration-200 flex flex-col justify-between overflow-hidden">
          
          <!-- 卡片上部内容 -->
          <div class="p-6">
            <!-- 头部：周序号 + 标题 + 模块标签 -->
            <div class="flex items-start justify-between gap-3 mb-4">
              <div class="flex items-center gap-2.5">
                <span class="${badgeStyle} text-xs font-black px-2.5 py-1 rounded-md tracking-wider shadow-sm">
                  ${w.id}
                </span>
                <h3 class="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors leading-snug">
                  ${w.title}
                </h3>
              </div>
              <span class="text-xs px-2 py-0.5 rounded-full border ${tagBg} font-medium shrink-0">
                ${w.tag}
              </span>
            </div>

            <!-- 核心知识清单（还原原图） -->
            <div class="mb-4">
              <div class="text-xs font-bold text-slate-800 tracking-wide uppercase mb-2 flex items-center gap-1.5">
                <span class="w-1.5 h-1.5 rounded-full bg-slate-700"></span>
                核心知识
              </div>
              <ul class="space-y-1.5 text-xs text-slate-600">
                ${w.coreKnowledge.map(item => `
                  <li class="flex items-start gap-1.5 leading-relaxed">
                    <span class="text-slate-400 select-none mt-0.5">•</span>
                    <span>${item}</span>
                  </li>
                `).join('')}
              </ul>
            </div>

            <!-- 场景提示框（还原原图绿色/浅色底框） -->
            <div class="bg-emerald-50/70 border border-emerald-100 rounded-xl p-3 text-xs text-emerald-900 mb-4 flex items-start gap-2">
              <span class="font-bold shrink-0 text-emerald-700 bg-emerald-200/60 px-1.5 py-0.5 rounded text-[10px]">场景</span>
              <span class="leading-relaxed">${w.scenario}</span>
            </div>
          </div>

          <!-- 卡片底部工具与操作栏（还原原图底部药丸标签 + 交互按钮） -->
          <div class="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
            <!-- 工具标签 -->
            <div class="flex flex-wrap items-center gap-1.5">
              ${w.tools.map(tool => `
                <span class="text-[11px] px-2.5 py-1 bg-white border border-slate-200 rounded-md text-slate-600 font-medium shadow-2xs hover:border-slate-300">
                  ${tool.name}
                </span>
              `).join('')}
            </div>

            <!-- 动作按钮群 -->
            <div class="flex items-center gap-1.5 shrink-0">
              <button onclick="toggleWeekCompletion('${w.id}', event)" title="${isCompleted ? '标记为未完成' : '标记为已学完'}" class="p-1.5 rounded-lg border text-xs transition-colors ${isCompleted ? 'bg-emerald-100 border-emerald-300 text-emerald-700 hover:bg-emerald-200' : 'bg-white border-slate-200 text-slate-400 hover:text-emerald-600 hover:border-emerald-300'}">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
              </button>
              <button onclick="openWeekDetail('${w.id}')" class="px-2.5 py-1 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-1">
                <span>实战教案</span>
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>

        </div>
      `;
    });

    el.weeksGrid.innerHTML = html;
  }

  // 打开每周详细实战弹窗
  window.openWeekDetail = function(weekId) {
    const w = data.weeks.find(item => item.id === weekId);
    if (!w) return;

    const isCompleted = state.completedWeeks.includes(w.id);
    const mod = getModule(w.moduleId);

    let modalHtml = `
      <div class="space-y-6">
        <!-- 弹窗顶栏 -->
        <div class="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div class="flex items-center gap-2 mb-1.5">
              <span class="bg-blue-600 text-white text-xs font-black px-2.5 py-0.5 rounded tracking-wider">${w.id}</span>
              <span class="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold">${w.tag} · ${mod.name}</span>
              <span class="text-xs text-slate-400">建议课时: 60分钟</span>
            </div>
            <h2 class="text-xl font-bold text-slate-900">${w.title}</h2>
            <p class="text-sm text-slate-500 mt-0.5">${w.subtitle}</p>
          </div>
          <button onclick="toggleWeekCompletion('${w.id}')" class="px-3.5 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition-all ${isCompleted ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'}">
            <svg class="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            <span>${isCompleted ? '已学完打卡' : '标记已掌握'}</span>
          </button>
        </div>

        <!-- 场景导入剖析 -->
        <div class="bg-emerald-50/80 border border-emerald-200 rounded-xl p-4">
          <div class="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-emerald-600"></span>
            大厂真实实战场景
          </div>
          <p class="text-sm font-semibold text-emerald-950">${w.scenario}</p>
          <p class="text-xs text-emerald-800 mt-2 leading-relaxed">${w.deepDive.background}</p>
        </div>

        <!-- 核心知识体系化拆解 -->
        <div>
          <h4 class="text-sm font-bold text-slate-900 mb-2.5 flex items-center gap-2">
            <span class="w-1.5 h-4 bg-blue-600 rounded"></span>
            核心知识与底层心法
          </h4>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            ${w.deepDive.keyTakeaways.map((takeaway, idx) => `
              <div class="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 text-xs text-slate-700 leading-relaxed flex flex-col justify-between">
                <div>
                  <span class="text-[10px] font-black text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded mb-1.5 inline-block">核心心法 0${idx+1}</span>
                  <p class="whitespace-pre-line mt-1">${takeaway}</p>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- 正反案例深度剖析 -->
        <div>
          <h4 class="text-sm font-bold text-slate-900 mb-2.5 flex items-center gap-2">
            <span class="w-1.5 h-4 bg-amber-500 rounded"></span>
            大厂正反案卷深度复盘 (15min 案例拆解)
          </h4>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- 正面范式 -->
            <div class="bg-emerald-50/50 border border-emerald-200 rounded-xl p-4">
              <div class="flex items-center gap-1.5 text-emerald-700 font-bold text-xs mb-2">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>高阶打法 (正面示范)</span>
              </div>
              <p class="text-xs text-slate-700 leading-relaxed">${w.deepDive.caseAnalysis.positive}</p>
            </div>

            <!-- 反面翻车 -->
            <div class="bg-rose-50/50 border border-rose-200 rounded-xl p-4">
              <div class="flex items-center gap-1.5 text-rose-700 font-bold text-xs mb-2">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>常见翻车现场 (反面警示)</span>
              </div>
              <p class="text-xs text-slate-700 leading-relaxed">${w.deepDive.caseAnalysis.negative}</p>
            </div>
          </div>
        </div>

        <!-- 现成高情商实操话术 -->
        <div>
          <h4 class="text-sm font-bold text-slate-900 mb-2.5 flex items-center gap-2">
            <span class="w-1.5 h-4 bg-purple-600 rounded"></span>
            实战话术锦囊 (开箱即用)
          </h4>
          <div class="space-y-2.5">
            ${w.deepDive.scripts.map(s => `
              <div class="bg-slate-900 text-slate-100 rounded-xl p-3.5 text-xs flex items-center justify-between gap-3">
                <div>
                  <span class="text-blue-400 font-bold mr-2">[${s.scene}]</span>
                  <span class="text-slate-200 font-mono">${s.line}</span>
                </div>
                <button onclick="copyToClipboard('${s.line.replace(/"/g, '&quot;')}')" class="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] font-semibold shrink-0 transition-colors">
                  一键复制
                </button>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- 课后行动与作业交付 -->
        <div class="bg-amber-50/70 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <div class="p-2 rounded-lg bg-amber-100 text-amber-800 shrink-0">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div>
            <div class="text-xs font-bold text-amber-900 mb-1">本周课后行动与交付物 (Action Items)</div>
            <p class="text-xs text-amber-800 leading-relaxed">${w.deepDive.actionItem}</p>
            <div class="mt-2.5 flex items-center gap-2">
              <span class="text-[11px] text-amber-900 font-semibold">配套产出模板：</span>
              ${w.tools.map(t => `
                <span class="inline-block text-[11px] bg-white border border-amber-300 px-2 py-0.5 rounded text-amber-900 font-medium">${t.name}</span>
              `).join('')}
            </div>
          </div>
        </div>

      </div>
    `;

    el.modalContent.innerHTML = modalHtml;
    el.activeModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  };

  // 关闭弹窗
  window.closeWeekDetail = function() {
    el.activeModal.classList.add('hidden');
    document.body.style.overflow = '';
  };

  // 原图画廊
  window.openConceptGallery = function() {
    const gallery = document.getElementById('gallery-modal');
    if (gallery) {
      gallery.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    }
  };

  window.closeConceptGallery = function() {
    const gallery = document.getElementById('gallery-modal');
    if (gallery) {
      gallery.classList.add('hidden');
      document.body.style.overflow = '';
    }
  };

  const galleryModal = document.getElementById('gallery-modal');
  if (galleryModal) {
    galleryModal.addEventListener('click', (e) => {
      if (e.target === galleryModal) closeConceptGallery();
    });
  }

  if (el.closeModalBtn) {
    el.closeModalBtn.addEventListener('click', closeWeekDetail);
  }
  if (el.activeModal) {
    el.activeModal.addEventListener('click', (e) => {
      if (e.target === el.activeModal) closeWeekDetail();
    });
  }

  // 绑定月份筛选
  el.monthFilterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      el.monthFilterBtns.forEach(b => {
        b.classList.remove('bg-blue-600', 'text-white', 'shadow');
        b.classList.add('bg-white', 'text-slate-600');
      });
      btn.classList.add('bg-blue-600', 'text-white', 'shadow');
      btn.classList.remove('bg-white', 'text-slate-600');
      state.selectedMonth = parseInt(btn.dataset.month, 10);
      renderWeeksGrid();
    });
  });

  // 绑定搜索框
  if (el.searchInput) {
    el.searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      renderWeeksGrid();
    });
  }

  // ================= 交互工具箱逻辑 =================

  // 1. 成熟度评测
  window.renderQuiz = function() {
    const container = document.getElementById('quiz-container');
    if (!container) return;

    if (state.quizSubmitted) {
      // 统计得分与段位
      let totalScore = 0;
      data.quizQuestions.forEach(q => {
        const selectedIdx = state.quizAnswers[q.id];
        if (selectedIdx !== undefined) {
          totalScore += q.options[selectedIdx].score;
        }
      });

      let rank = "L1 被动执行级";
      let rankDesc = "你目前容易将自己困在'工具人'心态中，对上级诉求认知模糊，且面临冲突或风险时容易被动拖延或情绪对抗。建议重点学习前4周认知重构与四维识人模型。";
      let rankColor = "text-amber-600";

      if (totalScore >= 34) {
        rank = "L4 价值共创合伙人";
        rankDesc = "你具备极高的大厂政治智慧与商业大局观！善于调频上级、结构化叙事、灰度谈判，并能将个人战功与组织战略紧密咬合，已具备高阶管理或专家潜质。";
        rankColor = "text-purple-600";
      } else if (totalScore >= 24) {
        rank = "L3 敏锐预判骨干";
        rankDesc = "你已经掌握了成熟的职场沟通机制，能够做到带方案报忧、条件化承诺。下一步重点是提升跨部门影响力与答辩晋升的高维叙事能力。";
        rankColor = "text-emerald-600";
      } else if (totalScore >= 14) {
        rank = "L2 主动协同执行";
        rankDesc = "能按时完成本职工作并保持基本沟通，但在'期望管理'和'向上拒绝'上还较为吃力，容易陷入老好人内耗或加班陷阱。";
        rankColor = "text-blue-600";
      }

      container.innerHTML = `
        <div class="bg-white rounded-2xl p-6 border border-slate-200 text-center max-w-2xl mx-auto">
          <span class="text-xs font-bold text-slate-400 uppercase tracking-widest">向上管理综合诊断报告</span>
          <div class="my-4">
            <span class="text-5xl font-black ${rankColor}">${totalScore}</span>
            <span class="text-slate-400 text-lg">/ 40 分</span>
          </div>
          <div class="inline-block px-4 py-1.5 rounded-full bg-slate-100 font-bold text-slate-800 text-sm mb-4">
            评定段位：<span class="${rankColor}">${rank}</span>
          </div>
          <p class="text-sm text-slate-600 leading-relaxed mb-6 px-4">${rankDesc}</p>
          <div class="flex items-center justify-center gap-3">
            <button onclick="resetQuiz()" class="px-5 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors">
              重新测试
            </button>
            <button onclick="copyToClipboard('我在大厂向上管理成熟度自测中获得 ${totalScore} 分（段位：${rank}），推荐你也来测测！')" class="px-5 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors">
              分享结果
            </button>
          </div>
        </div>
      `;
      return;
    }

    let html = `
      <div class="space-y-6 max-w-3xl mx-auto">
        <div class="text-center mb-6">
          <h3 class="text-lg font-bold text-slate-900">10分钟向上管理成熟度自测评</h3>
          <p class="text-xs text-slate-500 mt-1">涵盖大厂真实博弈场景，精准诊断你的职场向上管理段位与盲区</p>
        </div>
    `;

    data.quizQuestions.forEach((q, qIdx) => {
      const selected = state.quizAnswers[q.id];
      html += `
        <div class="bg-white p-5 rounded-2xl border border-slate-200">
          <div class="text-xs font-bold text-blue-600 mb-1">第 ${qIdx + 1} 题 / 共 10 题</div>
          <p class="text-sm font-semibold text-slate-900 mb-3">${q.question}</p>
          <div class="space-y-2">
            ${q.options.map((opt, oIdx) => `
              <label class="flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${selected === oIdx ? 'bg-blue-50 border-blue-400 text-blue-950 font-medium' : 'bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-700'}">
                <input type="radio" name="quiz_q_${q.id}" class="mt-0.5 text-blue-600 focus:ring-blue-500" ${selected === oIdx ? 'checked' : ''} onchange="selectQuizOption(${q.id}, ${oIdx})">
                <span class="text-xs leading-relaxed">${opt.text}</span>
              </label>
            `).join('')}
          </div>
        </div>
      `;
    });

    html += `
        <div class="text-center pt-4">
          <button onclick="submitQuiz()" class="px-8 py-3 rounded-xl bg-blue-600 text-white text-sm font-bold shadow-md hover:bg-blue-700 hover:shadow-lg transition-all">
            提交并生成诊断报告
          </button>
        </div>
      </div>
    `;

    container.innerHTML = html;
  };

  window.selectQuizOption = function(qId, optionIdx) {
    state.quizAnswers[qId] = optionIdx;
  };

  window.submitQuiz = function() {
    const answeredCount = Object.keys(state.quizAnswers).length;
    if (answeredCount < data.quizQuestions.length) {
      if (!confirm(`您还有 ${data.quizQuestions.length - answeredCount} 道题未作答，确认现在提交吗？未作答题目将计0分。`)) {
        return;
      }
    }
    state.quizSubmitted = true;
    renderQuiz();
  };

  window.resetQuiz = function() {
    state.quizAnswers = {};
    state.quizSubmitted = false;
    renderQuiz();
  };

  // 2. 上级类型锦囊切换
  window.renderLeaderTypes = function() {
    const container = document.getElementById('leader-types-container');
    if (!container) return;

    let html = `
      <div class="max-w-4xl mx-auto space-y-4">
        <div class="grid grid-cols-2 md:grid-cols-5 gap-2" id="leader-tabs">
          ${data.leaderTypes.map((item, idx) => `
            <button onclick="switchLeaderTab(${idx})" class="leader-tab-btn p-3 rounded-xl border text-center transition-all ${idx === 0 ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'}" data-index="${idx}">
              <div class="text-xs font-bold">${item.type.split(' ')[0]}</div>
              <div class="text-[10px] text-slate-400 mt-0.5">${item.alias}</div>
            </button>
          `).join('')}
        </div>
        <div id="leader-tab-detail"></div>
      </div>
    `;
    container.innerHTML = html;
    switchLeaderTab(0);
  };

  window.switchLeaderTab = function(idx) {
    const detailBox = document.getElementById('leader-tab-detail');
    if (!detailBox) return;

    document.querySelectorAll('.leader-tab-btn').forEach((btn, bIdx) => {
      if (bIdx === idx) {
        btn.classList.add('bg-slate-900', 'text-white', 'border-slate-900', 'shadow-sm');
        btn.classList.remove('bg-white', 'text-slate-700');
      } else {
        btn.classList.remove('bg-slate-900', 'text-white', 'border-slate-900', 'shadow-sm');
        btn.classList.add('bg-white', 'text-slate-700');
      }
    });

    const l = data.leaderTypes[idx];
    detailBox.innerHTML = `
      <div class="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
        <div class="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h4 class="text-lg font-bold text-slate-900">${l.type}</h4>
            <span class="text-xs text-slate-500">别称：${l.alias}</span>
          </div>
          <span class="text-xs font-semibold px-2.5 py-1 rounded bg-slate-100 text-slate-700">深度适配指南</span>
        </div>

        <div>
          <span class="text-xs font-bold text-slate-700 block mb-1.5">⚡ 识别信号 (特征表象)</span>
          <div class="flex flex-wrap gap-2">
            ${l.signals.map(s => `<span class="text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md">• ${s}</span>`).join('')}
          </div>
        </div>

        <div class="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-900">
          <span class="font-bold block mb-1">🧠 深层隐秘心理剖析：</span>
          <p class="leading-relaxed">${l.psychology}</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="bg-emerald-50/50 border border-emerald-200 rounded-xl p-3.5">
            <span class="text-xs font-bold text-emerald-800 block mb-2">✅ 正确适配打法 (DOs)</span>
            <ul class="text-xs text-slate-700 space-y-1.5">
              ${l.dos.map(d => `<li class="flex items-start gap-1.5"><span class="text-emerald-600 font-bold">✓</span>${d}</li>`).join('')}
            </ul>
          </div>
          <div class="bg-rose-50/50 border border-rose-200 rounded-xl p-3.5">
            <span class="text-xs font-bold text-rose-800 block mb-2">❌ 避坑大忌 (DONTs)</span>
            <ul class="text-xs text-slate-700 space-y-1.5">
              ${l.donts.map(d => `<li class="flex items-start gap-1.5"><span class="text-rose-600 font-bold">✕</span>${d}</li>`).join('')}
            </ul>
          </div>
        </div>

        <div class="bg-slate-900 rounded-xl p-4 text-xs text-white flex items-center justify-between gap-3">
          <div>
            <span class="text-amber-400 font-bold block mb-1">👑 黄金沟通必杀句：</span>
            <span class="text-slate-200 font-mono">${l.killerPhrase}</span>
          </div>
          <button onclick="copyToClipboard('${l.killerPhrase.replace(/"/g, '&quot;')}')" class="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold shrink-0 transition-colors">
            复制金句
          </button>
        </div>
      </div>
    `;
  };

  // 3. 报忧话术生成器
  window.renderBadNewsGenerator = function() {
    const container = document.getElementById('bad-news-container');
    if (!container) return;

    container.innerHTML = `
      <div class="max-w-2xl mx-auto bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div>
          <h4 class="text-base font-bold text-slate-900">坏消息 4 步报忧生成器</h4>
          <p class="text-xs text-slate-500 mt-0.5">公式：坏消息客观事实 + 根本原因分析 + 2个预选方案 + 倾向性推荐与风险预判</p>
        </div>

        <div class="space-y-3">
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">1. 坏消息客观事实 (发生什么/延期多久/何种风险)</label>
            <input type="text" id="bn-news" value="支付回调服务在压测中偶发超时，原定明天全量上线存在资损隐患" class="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none">
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">2. 根本原因 (外部依赖/历史技术债/人力限制)</label>
            <input type="text" id="bn-cause" value="第三方银行通道高并发下限流，且老系统缺少分布式锁防护" class="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none">
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">3. 方案 A (保守/保质量)</label>
              <input type="text" id="bn-plan-a" value="延期2天全量，完成熔断降级补丁与多轮压测后再上线" class="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none">
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">4. 方案 B (激进/保主流程)</label>
              <input type="text" id="bn-plan-b" value="按期上线但关闭非核心大额通道，仅开放小额支付" class="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none">
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">5. 你的推荐建议与后续行动</label>
            <input type="text" id="bn-recommend" value="推荐采取方案A。虽然推迟48小时，但能100%避开资损红线，我已协调运维组今晚加急联调" class="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none">
          </div>
        </div>

        <div class="pt-2 flex items-center justify-between">
          <button onclick="generateBadNewsScript()" class="px-5 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors">
            生成专业汇报话术
          </button>
        </div>

        <div id="bn-result-box" class="hidden mt-4 p-4 rounded-xl bg-slate-900 text-white text-xs space-y-2">
          <div class="flex items-center justify-between text-slate-400 border-b border-slate-800 pb-2">
            <span>生成的汇报话术范本</span>
            <button onclick="copyToClipboard(document.getElementById('bn-result-text').innerText)" class="text-blue-400 hover:text-blue-300 font-semibold">一键复制</button>
          </div>
          <p id="bn-result-text" class="font-mono text-slate-200 leading-relaxed whitespace-pre-wrap"></p>
        </div>
      </div>
    `;
  };

  window.generateBadNewsScript = function() {
    const news = document.getElementById('bn-news').value;
    const cause = document.getElementById('bn-cause').value;
    const planA = document.getElementById('bn-plan-a').value;
    const planB = document.getElementById('bn-plan-b').value;
    const recommend = document.getElementById('bn-recommend').value;

    const result = `Leader您好，向您紧急同步一个情况：\n\n【事实预警】${news}。\n【原因剖析】经团队排查，主要是由于${cause}所致。\n【应对方案】为保障业务大盘稳定，我们紧急制定了两个预选方案：\n  • 方案A：${planA}；\n  • 方案B：${planB}。\n【综合建议】结合风险与收益，我倾向于采取${recommend}。\n\n请您批示指正，如有需要我随时向您当面汇报细节！`;

    const box = document.getElementById('bn-result-box');
    const text = document.getElementById('bn-result-text');
    text.innerText = result;
    box.classList.remove('hidden');
  };

  // 4. 向上1页纸模板生成器
  window.renderOnePager = function() {
    const container = document.getElementById('one-pager-container');
    if (!container) return;

    const template = `【向上决策1页纸：海外多币种结算网关升级方案】

一、背景与核心痛点 (Why Now?)
随着公司Q3出海战略加速，现有单币种结算链路丢单率高达8.4%，外汇结算汇损月均超50万。重构网关成为保障Q4黑五大促核心指标的首要瓶颈。

二、方案选型对比 (Options)
• 方案1：采购第三方海外聚合支付SaaS服务
  - 成本：首年服务费80万 + 交易费率0.6%
  - 优势：上线周期快（预计3周完成）
  - 劣势：核心资金数据不在自建闭环，二次定制受限
• 方案2：自建轻量级多币种微服务网关 (推荐)
  - 成本：组内投入2名后端研发历时4周，硬件成本可复用当前算力
  - 优势：数据完全自主可控，长期ROI极高，支持大促无限次热插拔
  - 劣势：需临时向中台借调1名前端人员支持2周配置台搭建

三、核心推荐与投资回报率 (Recommendation & ROI)
推荐采纳【方案2】。测算上线后首月丢单率将压降至0.5%以内，预计每月直接减少汇损35万，3个月即可全面覆盖研发成本，并沉淀为出海中台底层核心资产。

四、风险控制与兜底预案 (Risks & Mitigation)
• 风险点：借调前端人员可能因其他S级项目冲突无法到位。
• 预案：已与前端负责人初步拉齐，若无法借调，将降级采用开源组件库完成管理后台搭建，核心结算底层不受任何影响。`;

    container.innerHTML = `
      <div class="max-w-3xl mx-auto bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h4 class="text-base font-bold text-slate-900">大厂向上 1 页纸 (Executive One-Pager) 标准范式</h4>
            <p class="text-xs text-slate-500">专供向高管、技术委员会汇报的高密度决策卡</p>
          </div>
          <button onclick="copyToClipboard(document.getElementById('one-pager-text').value)" class="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors">
            一键复制全文
          </button>
        </div>
        <textarea id="one-pager-text" rows="18" class="w-full text-xs font-mono p-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 leading-relaxed outline-none focus:bg-white focus:ring-2 focus:ring-blue-500">${template}</textarea>
      </div>
    `;
  };

  // 5. 建设性拒绝话术速查字典
  window.renderRefuseDict = function() {
    const container = document.getElementById('refuse-dict-container');
    if (!container) return;

    const list = [
      {
        type: "1. 条件置换法 (最具大厂智慧)",
        tag: "置换优先级",
        scenario: "周五临下班主管要求紧急插单一个非核心新需求",
        formula: "肯定价值 + 摆出当前核心盘 + 抛出排期置换选择题",
        script: "“Leader，这个新功能想法确实很有新意。不过目前团队都在全力冲刺下周一要交付的S级合规项目。如果要把这个需求插进来，我们可能需要把合规项目顺延到周三，或者砍掉原定模块B。您看我们要如何调优这两者的优先级？”"
      },
      {
        type: "2. 降配 MVP 法",
        tag: "降低交付成本",
        scenario: "业务方提出极其庞大复杂的需求，当前排期根本做不完",
        formula: "理解业务目标 + 拆解核心主干 + 提供简易版快速上线",
        script: "“我完全理解您想尽快验证用户裂变效果的初衷。完整版的大转盘抽奖需要3周联调，为了赶上这波流量，我建议我们先上线一个轻量级的H5分享领券MVP版本，3天就能上线验证数据，您看这样行吗？”"
      },
      {
        type: "3. 延期入池法",
        tag: "锁定节奏",
        scenario: "日常迭代中被频繁插入各种零碎的小优化",
        formula: "认可需求 + 强调当前迭代聚焦 + 纳入下期待办优先级排序",
        script: "“这个优化点非常敏锐！本双周Sprint的交付容量和测试排期已经全部锁死封板，为了保证版本质量，我先把它记录在下周一的规划Backlog池中，届时我们一起来评定最高优先级，您看如何？”"
      },
      {
        type: "4. 升级决策法",
        tag: "跨组仲裁",
        scenario: "平级业务部门跨部门强推需求，施加压力",
        formula: "客观表达资源瓶颈 + 不当夹心饼干 + 拉齐上级定夺",
        script: "“这个方向很有价值，但目前我们组Q3所有的研发HC都已按年初部门战略绑定。建议您与我们主管在周例会上统筹对齐一下这个项目的战略优先级，一旦管理层确认调配，我们立即全力配合。”"
      },
      {
        type: "5. 红线直接拒绝法",
        tag: "原则底线",
        scenario: "要求绕过数据合规、安全审计或财务制度直接上线",
        formula: "严正指出合规风险 + 说明连带责任 + 给出合规替代路径",
        script: "“这块逻辑涉及集团用户隐私保护与合规审计红线，若绕过合规上线，一旦被网信办通报整个业务线都将面临下架风险。为保障业务长远安全，我们必须走合规加急审批通道，我今天下班前帮您提交催审流程。”"
      }
    ];

    container.innerHTML = `
      <div class="max-w-3xl mx-auto space-y-4">
        ${list.map(item => `
          <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-bold text-slate-900">${item.type}</span>
              <span class="text-[10px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold">${item.tag}</span>
            </div>
            <div class="text-xs text-slate-500 mb-2">
              <span class="font-bold text-slate-700">场景：</span>${item.scenario}
            </div>
            <div class="bg-slate-900 rounded-xl p-3.5 text-xs text-white flex items-start justify-between gap-3">
              <div class="leading-relaxed">
                <span class="text-amber-400 font-bold block mb-1">应对高情商范本：</span>
                <span class="text-slate-200 font-mono">${item.script}</span>
              </div>
              <button onclick="copyToClipboard('${item.script.replace(/"/g, '&quot;')}')" class="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded text-[11px] font-semibold shrink-0 transition-colors mt-1">
                复制
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  };

  // 工具箱 Tab 切换
  window.switchToolTab = function(tabName) {
    state.activeToolTab = tabName;
    document.querySelectorAll('.tool-tab-btn').forEach(btn => {
      if (btn.dataset.tab === tabName) {
        btn.classList.add('bg-blue-600', 'text-white', 'shadow-sm');
        btn.classList.remove('bg-white', 'text-slate-700');
      } else {
        btn.classList.remove('bg-blue-600', 'text-white', 'shadow-sm');
        btn.classList.add('bg-white', 'text-slate-700');
      }
    });

    // 隐藏所有面板
    document.querySelectorAll('.tool-panel').forEach(p => p.classList.add('hidden'));

    // 展示目标面板并渲染对应内容
    const target = document.getElementById(`panel-${tabName}`);
    if (target) {
      target.classList.remove('hidden');
      if (tabName === 'quiz') renderQuiz();
      if (tabName === 'leaderTypes') renderLeaderTypes();
      if (tabName === 'badNews') renderBadNewsGenerator();
      if (tabName === 'onePager') renderOnePager();
      if (tabName === 'refuseDict') renderRefuseDict();
    }
  };

  // 初始化执行
  renderModuleFilters();
  renderWeeksGrid();
  updateProgress();
  switchToolTab('quiz');
});
