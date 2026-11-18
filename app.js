/**
 * 밀리핏 트래커 (MiliFit Tracker) 메인 애플리케이션 스크립트
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. 앱 초기화
  App.init();
});

const App = {
  settings: null,
  records: [],

  init() {
    this.settings = Store.getSettings();

    // 사용자가 첫 방문 시 예시 지표는 기본적으로 삭제된 상태(빈 상태)로 시작
    const hasInitializedClean = localStorage.getItem('milifit_started_clean_v2');
    if (!hasInitializedClean) {
      Store.clearAllRecords();
      localStorage.setItem('milifit_started_clean_v2', 'true');
      this.records = [];
    } else {
      this.records = Store.getRecords();
    }

    this.initUI();
    this.bindEvents();
    this.render();

    // Supabase 연동 시 클라우드에서 최신 데이터 자동 동기화
    if (window.SupabaseSync && SupabaseSync.isConnected()) {
      SupabaseSync.fetchRecords().then(res => {
        if (res.success && res.data && res.data.length > 0) {
          Store.syncRecordsFromCloud(res.data);
          this.records = Store.getRecords();
          this.render();
        }
      });
    }
  },

  initUI() {
    const currentUser = Store.getCurrentUser();

    // 프로필 셀렉터 초기값 반영
    const genderSelect = document.getElementById('userGender');
    const ageSelect = document.getElementById('userAgeGroup');
    if (genderSelect) genderSelect.value = this.settings.gender;
    if (ageSelect) ageSelect.value = this.settings.ageGroup;

    // 헤더 및 모달에 현재 사용자 이름 반영
    const nameHeader = document.getElementById('currentUserNameHeader');
    if (nameHeader) nameHeader.textContent = currentUser.name;

    const targetUserBadge = document.getElementById('recordTargetUserBadge');
    if (targetUserBadge) targetUserBadge.textContent = currentUser.name;

    // 입력 폼 오늘 날짜 기본 세팅
    const dateInput = document.getElementById('recordDate');
    if (dateInput) {
      dateInput.value = new Date().toISOString().split('T')[0];
    }

    // 클라우드(Supabase & 구글 시트) 연동 상태 뱃지 업데이트
    this.updateCloudStatusBadge();

    // 아이콘 렌더링 (Lucide)
    if (window.lucide) {
      window.lucide.createIcons();
    }
  },

  bindEvents() {
    // 프로필 설정 변경 이벤트
    const genderSelect = document.getElementById('userGender');
    const ageSelect = document.getElementById('userAgeGroup');

    if (genderSelect) {
      genderSelect.addEventListener('change', (e) => {
        this.settings.gender = e.target.value;
        Store.saveSettings({ gender: e.target.value });
        this.render();
        this.showToast('설정이 저장되었습니다 (성별 변경)', 'info');
      });
    }

    if (ageSelect) {
      ageSelect.addEventListener('change', (e) => {
        this.settings.ageGroup = e.target.value;
        Store.saveSettings({ ageGroup: e.target.value });
        this.render();
        this.showToast('연령대 기준표가 변경되었습니다.', 'info');
      });
    }

    // 기록 추가 폼 제출
    const form = document.getElementById('recordForm');
    if (form) {
      form.addEventListener('submit', (e) => this.handleFormSubmit(e));
    }

    // 입력 폼 실시간 등급 미리보기 이벤트
    const formInputs = ['recordWeight', 'recordRunMin', 'recordRunSec', 'recordPushup', 'recordSitup'];
    formInputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => this.updateFormLivePreview());
      }
    });

    // 샘플 데이터 재로드 버튼
    const reloadSampleBtn = document.getElementById('btnReloadSample');
    if (reloadSampleBtn) {
      reloadSampleBtn.addEventListener('click', () => {
        if (confirm('8주 점진적 과부하 샘플 데이터로 복원하시겠습니까? (기존 기록이 대체됩니다)')) {
          this.records = Store.loadSampleData();
          this.render();
          this.showToast('샘플 데이터가 로드되었습니다!', 'success');
        }
      });
    }

    // CSV 내보내기 버튼
    const exportCsvBtn = document.getElementById('btnExportCsv');
    if (exportCsvBtn) {
      exportCsvBtn.addEventListener('click', () => {
        if (Store.exportCSV()) {
          this.showToast('CSV 파일이 다운로드되었습니다.', 'success');
        } else {
          this.showToast('내보낼 기록이 없습니다.', 'warning');
        }
      });
    }

    // 새 사용자 추가 폼 제출 이벤트
    const addUserForm = document.getElementById('addUserForm');
    if (addUserForm) {
      addUserForm.addEventListener('submit', (e) => this.handleAddUserSubmit(e));
    }

    // 기록 초기화 버튼 (현재 사용자의 기록만 삭제)
    const clearAllBtn = document.getElementById('btnClearAll');
    if (clearAllBtn) {
      clearAllBtn.addEventListener('click', () => {
        const currentUser = Store.getCurrentUser();
        if (confirm(`[${currentUser.name}]님의 모든 측정 기록을 삭제하시겠습니까? (다른 사용자의 기록은 안전하게 보존됩니다)`)) {
          Store.clearAllRecordsForCurrentUser();
          this.records = [];
          this.render();
          this.showToast(`[${currentUser.name}]님의 모든 기록이 삭제되었습니다.`, 'info');
        }
      });
    }

    // 클라우드 연동 모달 관련 이벤트 (Supabase & 구글 시트)
    this.bindCloudModalEvents();
  },

  /**
   * 전체 화면 렌더링
   */
  render() {
    this.records = Store.getRecords();
    const latest = this.records.length > 0 ? this.records[this.records.length - 1] : null;

    this.renderTopBriefing(latest);
    this.renderMetricCards(latest);
    this.renderTable();
    this.renderStandardsModalTable();

    // 차트 업데이트
    if (window.FitnessCharts) {
      window.FitnessCharts.update(this.records, this.settings);
    }

    // 아이콘 재갱신
    if (window.lucide) {
      window.lucide.createIcons();
    }
  },

  /**
   * [핵심 요구사항] 대시보드 상단 강조 브리핑 카드
   * "현재 2급입니다. 특급까지 팔굽혀펴기 8개, 뜀걸음 30초 단축이 필요합니다"
   */
  renderTopBriefing(latest) {
    const banner = document.getElementById('topBriefingBanner');
    if (!banner) return;
    const currentUser = Store.getCurrentUser();

    if (!latest) {
      banner.innerHTML = `
        <div class="card-glass rounded-2xl p-6 sm:p-8 border border-slate-800 text-center relative overflow-hidden">
          <div class="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto mb-3">
            <i data-lucide="clipboard-list" class="w-6 h-6"></i>
          </div>
          <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 mb-2">
            <i data-lucide="user" class="w-3.5 h-3.5"></i>
            <span>[${currentUser.name}] 님의 체력 대시보드</span>
          </div>
          <h2 class="text-xl sm:text-2xl font-black text-white tracking-tight mb-2">
            [${currentUser.name}]님의 체력 측정 기록을 입력하고 특급 관문을 확인하세요!
          </h2>
          <p class="text-xs sm:text-sm text-slate-400 max-w-lg mx-auto mb-5 leading-relaxed">
            팔굽혀펴기, 윗몸일으키기, 3km 뜀걸음과 현재 체중을 기록하면 육군 공식 기준표와 대조하여 특급까지 남은 목표 수치를 즉각 안내합니다.
          </p>
          <button onclick="App.openModal('recordModal')" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 shadow-lg shadow-amber-500/20 transition-all">
            <i data-lucide="plus-circle" class="w-4 h-4"></i>
            <span>오늘의 첫 기록 입력하기</span>
          </button>
        </div>
      `;
      return;
    }

    const evaluation = ArmyStandards.evaluateFitness(
      this.settings.gender,
      this.settings.ageGroup,
      latest.runSec,
      latest.pushup,
      latest.situp
    );

    const overall = evaluation.overall;
    const isSpecial = overall.grade === 'special';

    // 뱃지 색상 테마 클래스
    let themeGlowClass = 'glow-blue';
    if (overall.grade === 'special') themeGlowClass = 'glow-gold';
    else if (overall.grade === 'g1') themeGlowClass = 'glow-emerald';
    else if (overall.grade === 'g2') themeGlowClass = 'glow-blue';
    else if (overall.grade === 'g3') themeGlowClass = 'border-orange-500/50';
    else themeGlowClass = 'border-red-500/50';

    // 종목별 칩(Badges) 렌더링
    const push = evaluation.events.pushup;
    const sit = evaluation.events.situp;
    const run = evaluation.events.run3k;

    banner.innerHTML = `
      <div class="card-glass rounded-2xl p-6 sm:p-8 border ${themeGlowClass} relative overflow-hidden transition-all duration-300">
        <!-- 배경 데코레이션 블러 -->
        <div class="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-amber-500/10 blur-3xl pointer-events-none"></div>

        <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div class="flex-1">
            <div class="flex flex-wrap items-center gap-3 mb-3">
              <span class="px-3.5 py-1.5 rounded-full text-xs font-black tracking-wider uppercase ${overall.badgeClass} shadow-md inline-flex items-center gap-1.5">
                <span>🎖️ 종합 ${overall.label}</span>
              </span>
              <span class="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 inline-flex items-center gap-1">
                <i data-lucide="user" class="w-3.5 h-3.5"></i> ${currentUser.name}
              </span>
              <span class="text-xs text-slate-400 font-medium flex items-center gap-1">
                <i data-lucide="calendar" class="w-3.5 h-3.5"></i> 최신 측정일: <strong class="text-slate-200">${latest.date}</strong>
              </span>
              <span class="text-xs px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 font-medium">
                체중: <strong class="text-amber-400">${latest.weight}kg</strong>
              </span>
            </div>

            <!-- 핵심 브리핑 헤드라인 문구 -->
            <h2 class="text-xl sm:text-2xl lg:text-3xl font-extrabold text-white tracking-tight leading-snug">
              <span class="text-amber-400 font-black">[${currentUser.name}]</span>님, 현재 <span class="underline decoration-wavy decoration-amber-400/80">${overall.label}</span>입니다. 
              <span class="text-amber-400 font-bold block sm:inline mt-1 sm:mt-0">${evaluation.specialTargetText}</span>
            </h2>
            ${evaluation.nextTargetText ? `
              <p class="text-xs sm:text-sm text-cyan-300 font-semibold mt-1.5 flex items-center gap-1.5">
                <i data-lucide="chevrons-up" class="w-4 h-4 text-cyan-400"></i>
                <span>${evaluation.nextTargetText}</span>
              </p>
            ` : ''}

            <!-- 종목별 즉시 달성 상태 칩 -->
            <div class="flex flex-wrap items-center gap-2 mt-4 text-xs font-medium">
              <div class="px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/80 flex items-center gap-1.5">
                <span class="text-slate-400">팔굽혀펴기:</span>
                <strong class="text-white">${push.val}회</strong>
                <span class="px-1.5 py-0.5 rounded text-[10px] ${push.eval.badgeClass}">${push.eval.label}</span>
                ${push.diffToSpecial > 0 ? `<span class="text-amber-400">(-${push.diffToSpecial}개)</span>` : `<span class="text-emerald-400">🏆특급달성</span>`}
              </div>

              <div class="px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/80 flex items-center gap-1.5">
                <span class="text-slate-400">윗몸일으키기:</span>
                <strong class="text-white">${sit.val}회</strong>
                <span class="px-1.5 py-0.5 rounded text-[10px] ${sit.eval.badgeClass}">${sit.eval.label}</span>
                ${sit.diffToSpecial > 0 ? `<span class="text-amber-400">(-${sit.diffToSpecial}개)</span>` : `<span class="text-emerald-400">🏆특급달성</span>`}
              </div>

              <div class="px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/80 flex items-center gap-1.5">
                <span class="text-slate-400">3km 뜀걸음:</span>
                <strong class="text-white">${ArmyStandards.formatSecondsToMinSec(run.val)}</strong>
                <span class="px-1.5 py-0.5 rounded text-[10px] ${run.eval.badgeClass}">${run.eval.label}</span>
                ${run.diffToSpecial > 0 ? `<span class="text-amber-400">(-${run.diffToSpecial}초 단축필요)</span>` : `<span class="text-emerald-400">🏆특급달성</span>`}
              </div>
            </div>
          </div>

          <!-- 특급 달성률 게이지 -->
          <div class="w-full md:w-56 shrink-0 bg-slate-800/80 p-4 rounded-xl border border-slate-700 flex flex-col justify-center">
            <div class="flex justify-between items-center text-xs mb-2">
              <span class="text-slate-400 font-semibold flex items-center gap-1">
                <i data-lucide="target" class="w-3.5 h-3.5 text-amber-400"></i> 특급전사 달성률
              </span>
              <strong class="text-amber-400 text-sm">${evaluation.totalProgress}%</strong>
            </div>
            <div class="w-full h-3 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-700">
              <div class="h-full bg-gradient-to-r from-amber-500 to-yellow-400 rounded-full transition-all duration-700" style="width: ${evaluation.totalProgress}%"></div>
            </div>
            <div class="mt-2 text-[11px] text-slate-400 text-center">
              ${isSpecial ? '🎉 전 종목 특급 완성!' : '특급까지 남은 관문을 돌파하세요!'}
            </div>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * 4대 메트릭 요약 카드 렌더링
   */
  renderMetricCards(latest) {
    const container = document.getElementById('metricCardsGrid');
    if (!container) return;

    if (!latest) {
      const genderStd = ArmyStandards.ARMY_STANDARDS[this.settings.gender || 'male'] || ArmyStandards.ARMY_STANDARDS.male;
      const std = genderStd[this.settings.ageGroup || 'under_25'] || genderStd.under_25;

      container.innerHTML = `
        <!-- 1. 3km 뜀걸음 카드 -->
        <div class="card-glass rounded-2xl p-5 border border-slate-800">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
                <i data-lucide="timer" class="w-4 h-4"></i>
              </div>
              <span class="text-xs font-bold text-slate-400 uppercase tracking-wide">3km 뜀걸음</span>
            </div>
            <span class="px-2 py-0.5 rounded text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">측정 대기</span>
          </div>
          <div class="flex items-baseline gap-2 mb-1">
            <h3 class="text-2xl font-black text-slate-500">--:--</h3>
          </div>
          <div class="text-xs text-slate-400 mb-3">
            특급 기준: <span class="text-amber-400 font-semibold">${ArmyStandards.formatSecondsToMinSec(std.run3k.special)} 이내</span>
          </div>
          <div class="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div class="bg-amber-400 h-full rounded-full" style="width: 0%"></div>
          </div>
          <div class="mt-2 text-xs text-slate-500">
            새 기록을 입력해주세요
          </div>
        </div>

        <!-- 2. 팔굽혀펴기 카드 -->
        <div class="card-glass rounded-2xl p-5 border border-slate-800">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <i data-lucide="biceps-flexed" class="w-4 h-4"></i>
              </div>
              <span class="text-xs font-bold text-slate-400 uppercase tracking-wide">팔굽혀펴기 (2분)</span>
            </div>
            <span class="px-2 py-0.5 rounded text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">측정 대기</span>
          </div>
          <div class="flex items-baseline gap-2 mb-1">
            <h3 class="text-2xl font-black text-slate-500">-- <span class="text-sm font-normal text-slate-600">회</span></h3>
          </div>
          <div class="text-xs text-slate-400 mb-3">
            특급 기준: <span class="text-emerald-400 font-semibold">${std.pushup.special}회 이상</span>
          </div>
          <div class="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div class="bg-emerald-400 h-full rounded-full" style="width: 0%"></div>
          </div>
          <div class="mt-2 text-xs text-slate-500">
            새 기록을 입력해주세요
          </div>
        </div>

        <!-- 3. 윗몸일으키기 카드 -->
        <div class="card-glass rounded-2xl p-5 border border-slate-800">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
                <i data-lucide="flame" class="w-4 h-4"></i>
              </div>
              <span class="text-xs font-bold text-slate-400 uppercase tracking-wide">윗몸일으키기 (2분)</span>
            </div>
            <span class="px-2 py-0.5 rounded text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">측정 대기</span>
          </div>
          <div class="flex items-baseline gap-2 mb-1">
            <h3 class="text-2xl font-black text-slate-500">-- <span class="text-sm font-normal text-slate-600">회</span></h3>
          </div>
          <div class="text-xs text-slate-400 mb-3">
            특급 기준: <span class="text-blue-400 font-semibold">${std.situp.special}회 이상</span>
          </div>
          <div class="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div class="bg-blue-400 h-full rounded-full" style="width: 0%"></div>
          </div>
          <div class="mt-2 text-xs text-slate-500">
            새 기록을 입력해주세요
          </div>
        </div>

        <!-- 4. 현재 체중 & 체급 카드 -->
        <div class="card-glass rounded-2xl p-5 border border-slate-800">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-lg bg-pink-500/10 flex items-center justify-center text-pink-400">
                <i data-lucide="scale" class="w-4 h-4"></i>
              </div>
              <span class="text-xs font-bold text-slate-400 uppercase tracking-wide">현재 체중 & 체급</span>
            </div>
            <span class="px-2 py-0.5 rounded text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">측정 대기</span>
          </div>
          <div class="flex items-baseline gap-2 mb-1">
            <h3 class="text-2xl font-black text-slate-500">-- <span class="text-sm font-normal text-slate-600">kg</span></h3>
          </div>
          <div class="text-xs text-slate-400 mb-3">
            기록 수: <span class="text-slate-300 font-semibold">0회차</span>
          </div>
          <div class="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800/80 text-[11px] text-slate-400">
            기록 입력 시 체중 변화와 퍼포먼스가 자동 누적됩니다.
          </div>
          <div class="mt-2 text-xs text-slate-500 text-right">
            시작 체중 대기 중
          </div>
        </div>
      `;
      return;
    }

    const evaluation = ArmyStandards.evaluateFitness(
      this.settings.gender,
      this.settings.ageGroup,
      latest.runSec,
      latest.pushup,
      latest.situp
    );

    const std = evaluation.standard;
    const push = evaluation.events.pushup;
    const sit = evaluation.events.situp;
    const run = evaluation.events.run3k;

    // 시작 대비 체중 변화량
    const firstRec = this.records[0];
    const weightChange = (latest.weight - firstRec.weight).toFixed(1);
    const weightChangeText = weightChange < 0 
      ? `<span class="text-emerald-400">-${Math.abs(weightChange)}kg 감량 📉</span>`
      : weightChange > 0 
        ? `<span class="text-amber-400">+${weightChange}kg 📈</span>`
        : `<span class="text-slate-400">변화 없음</span>`;

    container.innerHTML = `
      <!-- 1. 3km 뜀걸음 카드 -->
      <div class="card-glass card-glass-hover rounded-2xl p-5 border border-slate-800">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
              <i data-lucide="timer" class="w-4 h-4"></i>
            </div>
            <span class="text-xs font-bold text-slate-400 uppercase tracking-wide">3km 뜀걸음</span>
          </div>
          <span class="px-2 py-0.5 rounded text-xs font-bold ${run.eval.badgeClass}">${run.eval.label}</span>
        </div>
        <div class="flex items-baseline gap-2 mb-1">
          <h3 class="text-2xl font-black text-white">${ArmyStandards.formatSecondsToMinSec(run.val)}</h3>
        </div>
        <div class="text-xs text-slate-400 mb-3">
          특급 기준: <span class="text-slate-300 font-semibold">${ArmyStandards.formatSecondsToMinSec(std.run3k.special)} 이내</span>
        </div>
        <div class="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
          <div class="bg-amber-400 h-full rounded-full transition-all duration-500" style="width: ${run.progress}%"></div>
        </div>
        <div class="mt-2 text-xs flex justify-between text-slate-400">
          <span>진척도: ${run.progress}%</span>
          <span class="${run.diffToSpecial > 0 ? 'text-amber-400 font-semibold' : 'text-emerald-400 font-semibold'}">
            ${run.diffToSpecial > 0 ? `${run.diffToSpecial}초 단축 필요` : '🏆 특급 달성'}
          </span>
        </div>
      </div>

      <!-- 2. 팔굽혀펴기 카드 -->
      <div class="card-glass card-glass-hover rounded-2xl p-5 border border-slate-800">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <i data-lucide="biceps-flexed" class="w-4 h-4"></i>
            </div>
            <span class="text-xs font-bold text-slate-400 uppercase tracking-wide">팔굽혀펴기 (2분)</span>
          </div>
          <span class="px-2 py-0.5 rounded text-xs font-bold ${push.eval.badgeClass}">${push.eval.label}</span>
        </div>
        <div class="flex items-baseline gap-2 mb-1">
          <h3 class="text-2xl font-black text-white">${push.val} <span class="text-sm font-normal text-slate-400">회</span></h3>
        </div>
        <div class="text-xs text-slate-400 mb-3">
          특급 기준: <span class="text-slate-300 font-semibold">${std.pushup.special}회 이상</span>
        </div>
        <div class="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
          <div class="bg-emerald-400 h-full rounded-full transition-all duration-500" style="width: ${push.progress}%"></div>
        </div>
        <div class="mt-2 text-xs flex justify-between text-slate-400">
          <span>진척도: ${push.progress}%</span>
          <span class="${push.diffToSpecial > 0 ? 'text-amber-400 font-semibold' : 'text-emerald-400 font-semibold'}">
            ${push.diffToSpecial > 0 ? `+${push.diffToSpecial}개 필요` : '🏆 특급 달성'}
          </span>
        </div>
      </div>

      <!-- 3. 윗몸일으키기 카드 -->
      <div class="card-glass card-glass-hover rounded-2xl p-5 border border-slate-800">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
              <i data-lucide="flame" class="w-4 h-4"></i>
            </div>
            <span class="text-xs font-bold text-slate-400 uppercase tracking-wide">윗몸일으키기 (2분)</span>
          </div>
          <span class="px-2 py-0.5 rounded text-xs font-bold ${sit.eval.badgeClass}">${sit.eval.label}</span>
        </div>
        <div class="flex items-baseline gap-2 mb-1">
          <h3 class="text-2xl font-black text-white">${sit.val} <span class="text-sm font-normal text-slate-400">회</span></h3>
        </div>
        <div class="text-xs text-slate-400 mb-3">
          특급 기준: <span class="text-slate-300 font-semibold">${std.situp.special}회 이상</span>
        </div>
        <div class="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
          <div class="bg-blue-400 h-full rounded-full transition-all duration-500" style="width: ${sit.progress}%"></div>
        </div>
        <div class="mt-2 text-xs flex justify-between text-slate-400">
          <span>진척도: ${sit.progress}%</span>
          <span class="${sit.diffToSpecial > 0 ? 'text-amber-400 font-semibold' : 'text-emerald-400 font-semibold'}">
            ${sit.diffToSpecial > 0 ? `+${sit.diffToSpecial}개 필요` : '🏆 특급 달성'}
          </span>
        </div>
      </div>

      <!-- 4. 현재 체중 & 체급 통합 카드 -->
      <div class="card-glass card-glass-hover rounded-2xl p-5 border border-slate-800">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-lg bg-pink-500/10 flex items-center justify-center text-pink-400">
              <i data-lucide="scale" class="w-4 h-4"></i>
            </div>
            <span class="text-xs font-bold text-slate-400 uppercase tracking-wide">현재 체중 & 체급</span>
          </div>
          <span class="px-2 py-0.5 rounded text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">시작 ${firstRec.weight}kg</span>
        </div>
        <div class="flex items-baseline gap-2 mb-1">
          <h3 class="text-2xl font-black text-white">${latest.weight} <span class="text-sm font-normal text-slate-400">kg</span></h3>
        </div>
        <div class="text-xs text-slate-400 mb-3">
          첫 측정 대비: ${weightChangeText}
        </div>
        <div class="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800/80 text-[11px] text-slate-300 flex items-center justify-between">
          <span class="text-slate-400">맨몸운동 합산 볼륨:</span>
          <strong class="text-pink-300">${latest.pushup + latest.situp}회 (체중 대비 근력)</strong>
        </div>
        <div class="mt-2 text-xs text-right text-slate-400">
          기록수: <strong class="text-slate-200">${this.records.length}회차</strong>
        </div>
      </div>
    `;
  },

  /**
   * 측정 히스토리 테이블 렌더링
   */
  renderTable() {
    const tbody = document.getElementById('recordTableBody');
    const emptyState = document.getElementById('recordTableEmpty');
    if (!tbody) return;

    if (this.records.length === 0) {
      tbody.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      return;
    }
    if (emptyState) emptyState.classList.add('hidden');

    // 최신순으로 정렬하여 표에 출력
    const reversed = [...this.records].reverse();

    tbody.innerHTML = reversed.map(r => {
      const evalResult = ArmyStandards.evaluateFitness(
        this.settings.gender,
        this.settings.ageGroup,
        r.runSec,
        r.pushup,
        r.situp
      );

      const runFmt = ArmyStandards.formatSecondsToMinSec(r.runSec);
      const overall = evalResult.overall;

      return `
        <tr class="border-b border-slate-800 hover:bg-slate-800/40 transition-colors text-sm">
          <td class="py-3.5 px-4 font-semibold text-slate-200 whitespace-nowrap">
            ${r.date}
          </td>
          <td class="py-3.5 px-4 text-amber-300 font-bold whitespace-nowrap">
            ${r.weight} kg
          </td>
          <td class="py-3.5 px-4 whitespace-nowrap">
            <div class="flex items-center gap-1.5">
              <span>${runFmt}</span>
              <span class="text-[10px] px-1.5 py-0.5 rounded ${evalResult.events.run3k.eval.badgeClass}">${evalResult.events.run3k.eval.label}</span>
            </div>
          </td>
          <td class="py-3.5 px-4 whitespace-nowrap">
            <div class="flex items-center gap-1.5">
              <span>${r.pushup} 회</span>
              <span class="text-[10px] px-1.5 py-0.5 rounded ${evalResult.events.pushup.eval.badgeClass}">${evalResult.events.pushup.eval.label}</span>
            </div>
          </td>
          <td class="py-3.5 px-4 whitespace-nowrap">
            <div class="flex items-center gap-1.5">
              <span>${r.situp} 회</span>
              <span class="text-[10px] px-1.5 py-0.5 rounded ${evalResult.events.situp.eval.badgeClass}">${evalResult.events.situp.eval.label}</span>
            </div>
          </td>
          <td class="py-3.5 px-4 whitespace-nowrap">
            <span class="px-2.5 py-1 rounded-full text-xs font-bold ${overall.badgeClass}">
              ${overall.label}
            </span>
          </td>
          <td class="py-3.5 px-4 text-xs text-slate-400 max-w-xs truncate" title="${r.notes || ''}">
            ${r.notes || '-'}
          </td>
          <td class="py-3.5 px-4 text-center whitespace-nowrap">
            <button onclick="App.deleteRecordItem('${r.id}')" class="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors" title="기록 삭제">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  },

  /**
   * 단일 기록 삭제
   */
  deleteRecordItem(id) {
    if (confirm('이 기록을 삭제하시겠습니까?')) {
      Store.deleteRecord(id);
      if (window.SupabaseSync && SupabaseSync.isConnected()) {
        SupabaseSync.deleteRecord(id);
      }
      this.render();
      this.showToast('기록이 삭제되었습니다.', 'info');
    }
  },

  /**
   * 입력 폼 실시간 등급 미리보기 박스 업데이트
   */
  updateFormLivePreview() {
    const previewBox = document.getElementById('formLivePreview');
    if (!previewBox) return;

    const weight = parseFloat(document.getElementById('recordWeight')?.value) || 0;
    const runMin = parseInt(document.getElementById('recordRunMin')?.value, 10) || 0;
    const runSecOnly = parseInt(document.getElementById('recordRunSec')?.value, 10) || 0;
    const pushup = parseInt(document.getElementById('recordPushup')?.value, 10) || 0;
    const situp = parseInt(document.getElementById('recordSitup')?.value, 10) || 0;

    const runTotalSec = runMin * 60 + runSecOnly;

    if (runTotalSec === 0 && pushup === 0 && situp === 0) {
      previewBox.classList.add('hidden');
      return;
    }

    const evaluation = ArmyStandards.evaluateFitness(
      this.settings.gender,
      this.settings.ageGroup,
      runTotalSec,
      pushup,
      situp
    );

    previewBox.classList.remove('hidden');
    previewBox.innerHTML = `
      <div class="p-3.5 rounded-xl bg-slate-900 border border-slate-700/80 flex items-center justify-between text-xs">
        <div class="flex items-center gap-2">
          <span class="px-2 py-0.5 rounded font-bold ${evaluation.overall.badgeClass}">종합 ${evaluation.overall.label}</span>
          <span class="text-slate-300">${evaluation.specialTargetText}</span>
        </div>
        <span class="text-slate-400 font-mono">${ArmyStandards.formatSecondsToMinSec(runTotalSec)} | ${pushup}회 | ${situp}회</span>
      </div>
    `;
  },

  /**
   * 신규 기록 폼 제출 처리
   */
  async handleFormSubmit(e) {
    e.preventDefault();

    const date = document.getElementById('recordDate').value;
    const weight = parseFloat(document.getElementById('recordWeight').value);
    const runMin = parseInt(document.getElementById('recordRunMin').value, 10) || 0;
    const runSecOnly = parseInt(document.getElementById('recordRunSec').value, 10) || 0;
    const pushup = parseInt(document.getElementById('recordPushup').value, 10) || 0;
    const situp = parseInt(document.getElementById('recordSitup').value, 10) || 0;
    const notes = document.getElementById('recordNotes').value.trim();

    if (!date) {
      this.showToast('측정 날짜를 선택해주세요.', 'warning');
      return;
    }
    if (isNaN(weight) || weight <= 0) {
      this.showToast('현재 체중을 올바르게 입력해주세요 (예: 88.0kg)', 'warning');
      return;
    }

    const runTotalSec = runMin * 60 + runSecOnly;

    const evaluation = ArmyStandards.evaluateFitness(
      this.settings.gender,
      this.settings.ageGroup,
      runTotalSec,
      pushup,
      situp
    );

    const recordData = {
      date,
      weight,
      runMin,
      runSecOnly,
      runSec: runTotalSec,
      pushup,
      situp,
      overallGrade: evaluation.overall.label,
      notes,
      syncedWithSheet: false
    };

    // 1. 로컬 스토리지에 즉각 저장
    const saved = Store.addRecord(recordData);

    // 2. 모달 닫기 및 폼 초기화
    this.closeModal('recordModal');
    e.target.reset();
    document.getElementById('recordDate').value = new Date().toISOString().split('T')[0];
    const previewBox = document.getElementById('formLivePreview');
    if (previewBox) previewBox.classList.add('hidden');

    // 3. 화면 재렌더링
    this.render();

    // 특급 달성 시 축하 콘페티(폭죽) 애니메이션 효과!
    if (evaluation.overall.grade === 'special' && window.confetti) {
      window.confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
    }

    this.showToast(`기록이 저장되었습니다! (종합 ${evaluation.overall.label})`, 'success');

    // 4-1. Supabase가 연결되어 있다면 클라우드 DB 자동 전송!
    if (window.SupabaseSync && SupabaseSync.isConnected()) {
      SupabaseSync.insertRecord(saved).then(sbRes => {
        if (sbRes.success && sbRes.data) {
          Store.updateRecord(saved.id, { id: sbRes.data.id, syncedWithSupabase: true });
          this.render();
          this.showToast('Supabase 클라우드 DB에 동기화 완료! ⚡', 'success');
        }
      });
    }

    // 4-2. 구글 시트가 연결되어 있다면 백그라운드 자동 전송!
    if (GoogleSheetsSync.isConnected()) {
      this.showToast('구글 시트로 동기화 중...', 'info');
      GoogleSheetsSync.appendRecord(saved).then(syncResult => {
        if (syncResult.success) {
          Store.updateRecord(saved.id, { syncedWithSheet: true });
          this.render();
          this.showToast('구글 스프레드시트에 성공적으로 기록되었습니다! 📊', 'success');
        } else {
          this.showToast('구글 시트 전송 실패 (로컬에 안전하게 저장됨)', 'warning');
        }
      });
    }
  },

  /**
   * 육군 체력검정 기준표 모달 테이블 렌더링
   */
  renderStandardsModalTable() {
    const tableBody = document.getElementById('standardsTableBody');
    if (!tableBody) return;

    const gender = this.settings.gender;
    const currentAgeKey = this.settings.ageGroup;
    const genderData = ArmyStandards.ARMY_STANDARDS[gender] || ArmyStandards.ARMY_STANDARDS.male;

    let rowsHtml = '';
    for (const [ageKey, data] of Object.entries(genderData)) {
      const isSelectedAge = ageKey === currentAgeKey;
      const highlightClass = isSelectedAge ? 'bg-amber-500/15 border-l-4 border-amber-400 font-bold' : '';

      rowsHtml += `
        <tr class="border-b border-slate-800 text-xs ${highlightClass}">
          <td class="py-3 px-3 text-slate-200 whitespace-nowrap">
            ${data.label} ${isSelectedAge ? '<span class="text-amber-400 ml-1">(내 설정)</span>' : ''}
          </td>
          <!-- 팔굽혀펴기 -->
          <td class="py-3 px-2 text-center text-amber-300 font-semibold">${data.pushup.special} 이상</td>
          <td class="py-3 px-2 text-center text-emerald-300">${data.pushup.g1}~${data.pushup.special - 1}</td>
          <td class="py-3 px-2 text-center text-blue-300">${data.pushup.g2}~${data.pushup.g1 - 1}</td>
          <td class="py-3 px-2 text-center text-orange-300">${data.pushup.g3}~${data.pushup.g2 - 1}</td>
          <!-- 윗몸일으키기 -->
          <td class="py-3 px-2 text-center text-amber-300 font-semibold border-l border-slate-800">${data.situp.special} 이상</td>
          <td class="py-3 px-2 text-center text-emerald-300">${data.situp.g1}~${data.situp.special - 1}</td>
          <td class="py-3 px-2 text-center text-blue-300">${data.situp.g2}~${data.situp.g1 - 1}</td>
          <td class="py-3 px-2 text-center text-orange-300">${data.situp.g3}~${data.situp.g2 - 1}</td>
          <!-- 3km 뜀걸음 -->
          <td class="py-3 px-2 text-center text-amber-300 font-semibold border-l border-slate-800">${ArmyStandards.formatSecondsToMinSec(data.run3k.special)}</td>
          <td class="py-3 px-2 text-center text-emerald-300">${ArmyStandards.formatSecondsToMinSec(data.run3k.g1)}</td>
          <td class="py-3 px-2 text-center text-blue-300">${ArmyStandards.formatSecondsToMinSec(data.run3k.g2)}</td>
          <td class="py-3 px-2 text-center text-orange-300">${ArmyStandards.formatSecondsToMinSec(data.run3k.g3)}</td>
        </tr>
      `;
    }

    tableBody.innerHTML = rowsHtml;
  },

  /**
   * 클라우드 연동 탭 전환 (Supabase vs 구글 시트)
   */
  switchCloudTab(tabName) {
    const tabBtnSb = document.getElementById('tabBtnSupabase');
    const tabBtnGs = document.getElementById('tabBtnSheets');
    const contentSb = document.getElementById('tabContentSupabase');
    const contentGs = document.getElementById('tabContentSheets');

    if (tabName === 'supabase') {
      contentSb?.classList.remove('hidden');
      contentGs?.classList.add('hidden');
      tabBtnSb?.classList.add('text-emerald-400', 'border-emerald-400');
      tabBtnSb?.classList.remove('text-slate-400', 'border-transparent');
      tabBtnGs?.classList.remove('text-emerald-400', 'border-emerald-400');
      tabBtnGs?.classList.add('text-slate-400', 'border-transparent');
    } else {
      contentGs?.classList.remove('hidden');
      contentSb?.classList.add('hidden');
      tabBtnGs?.classList.add('text-emerald-400', 'border-emerald-400');
      tabBtnGs?.classList.remove('text-slate-400', 'border-transparent');
      tabBtnSb?.classList.remove('text-emerald-400', 'border-emerald-400');
      tabBtnSb?.classList.add('text-slate-400', 'border-transparent');
    }
  },

  /**
   * 클라우드 연동 모달 관련 이벤트 바인딩 (Supabase & 구글 시트)
   */
  bindCloudModalEvents() {
    // 1. Supabase 요소 바인딩
    const inputSbUrl = document.getElementById('supabaseProjectUrl');
    const inputSbKey = document.getElementById('supabaseAnonKey');
    const btnTestSb = document.getElementById('btnTestSupabase');
    const btnSaveSb = document.getElementById('btnSaveSupabase');
    const btnSyncSb = document.getElementById('btnSyncToSupabase');
    const btnPullSb = document.getElementById('btnPullFromSupabase');
    const btnCopySql = document.getElementById('btnCopySupabaseSql');

    if (inputSbUrl && window.SupabaseSync) inputSbUrl.value = SupabaseSync.getUrl();
    if (inputSbKey && window.SupabaseSync) inputSbKey.value = SupabaseSync.getKey();

    // SQL 복사
    if (btnCopySql) {
      btnCopySql.addEventListener('click', () => {
        const sql = `create table if not exists public.milifit_records (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  user_name text not null default '나의 기록',
  date text not null,
  weight numeric(4,1) not null,
  run_min integer not null default 0,
  run_sec_only integer not null default 0,
  run_sec integer not null,
  pushup integer not null default 0,
  situp integer not null default 0,
  overall_grade text,
  notes text
);
alter table public.milifit_records enable row level security;
create policy "Allow anon full access" on public.milifit_records for all to anon using (true) with check (true);
create index if not exists idx_milifit_records_user_date on public.milifit_records (user_name, date);`;
        navigator.clipboard.writeText(sql).then(() => {
          this.showToast('Supabase SQL 테이블 생성 코드가 복사되었습니다!', 'success');
        });
      });
    }

    // Supabase 연결 테스트
    if (btnTestSb) {
      btnTestSb.addEventListener('click', async () => {
        const url = inputSbUrl?.value?.trim();
        const key = inputSbKey?.value?.trim();
        if (!url || !key) {
          this.showToast('Project URL과 Anon Key를 모두 입력해주세요.', 'warning');
          return;
        }
        btnTestSb.disabled = true;
        btnTestSb.innerHTML = '연결 확인 중...';
        const res = await SupabaseSync.testConnection(url, key);
        btnTestSb.disabled = false;
        btnTestSb.innerHTML = '연결 테스트';

        if (res.success) {
          this.showToast(res.message, 'success');
        } else {
          this.showToast(res.message, 'error');
        }
      });
    }

    // Supabase 설정 저장
    if (btnSaveSb) {
      btnSaveSb.addEventListener('click', () => {
        const url = inputSbUrl?.value?.trim() || '';
        const key = inputSbKey?.value?.trim() || '';
        SupabaseSync.setCredentials(url, key);
        this.updateCloudStatusBadge();
        this.showToast('Supabase 연동 정보가 저장되었습니다! ⚡', 'success');
        this.closeModal('cloudModal');
      });
    }

    // Supabase로 로컬 데이터 일괄 백업
    if (btnSyncSb) {
      btnSyncSb.addEventListener('click', async () => {
        if (!SupabaseSync.isConnected()) {
          this.showToast('먼저 Supabase URL과 Key를 저장해주세요.', 'warning');
          return;
        }
        const allLocal = Store.getAllRawRecords();
        if (allLocal.length === 0) {
          this.showToast('Supabase에 올릴 로컬 기록이 없습니다.', 'warning');
          return;
        }
        if (confirm(`모든 사용자의 로컬 기록 총 ${allLocal.length}건을 Supabase로 올리시겠습니까?`)) {
          btnSyncSb.disabled = true;
          btnSyncSb.innerHTML = '업로드 중...';
          const res = await SupabaseSync.syncAllLocalToSupabase(allLocal);
          btnSyncSb.disabled = false;
          btnSyncSb.innerHTML = '로컬 기록 Supabase로 올리기';

          if (res.success) {
            this.showToast(res.message, 'success');
          } else {
            this.showToast(res.message, 'error');
          }
        }
      });
    }

    // Supabase에서 데이터 불러오기
    if (btnPullSb) {
      btnPullSb.addEventListener('click', async () => {
        if (!SupabaseSync.isConnected()) {
          this.showToast('먼저 Supabase URL과 Key를 저장해주세요.', 'warning');
          return;
        }
        btnPullSb.disabled = true;
        btnPullSb.innerHTML = '불러오는 중...';
        const res = await SupabaseSync.fetchRecords();
        btnPullSb.disabled = false;
        btnPullSb.innerHTML = '불러오기';

        if (res.success && res.data) {
          if (res.data.length === 0) {
            this.showToast('Supabase에 등록된 기록이 없습니다.', 'info');
            return;
          }
          if (confirm(`Supabase에서 총 ${res.data.length}건의 기록을 가져왔습니다. 로컬에 동기화하시겠습니까?`)) {
            Store.syncRecordsFromCloud(res.data);
            this.records = Store.getRecords();
            this.initUI();
            this.render();
            this.showToast(`${res.data.length}건을 Supabase에서 동기화했습니다!`, 'success');
          }
        } else {
          this.showToast(res.message, 'error');
        }
      });
    }

    // 2. 구글 시트 요소 바인딩
    const inputUrl = document.getElementById('sheetWebAppUrl');
    const btnTest = document.getElementById('btnTestSheetConnection');
    const btnSave = document.getElementById('btnSaveSheetUrl');
    const btnBatchSync = document.getElementById('btnBatchSyncToSheet');
    const btnPullFromSheet = document.getElementById('btnPullFromSheet');

    if (inputUrl) {
      inputUrl.value = GoogleSheetsSync.getUrl();
    }

    // 연결 테스트
    if (btnTest) {
      btnTest.addEventListener('click', async () => {
        const url = inputUrl?.value?.trim();
        if (!url) {
          this.showToast('웹 앱 URL을 입력해주세요.', 'warning');
          return;
        }
        btnTest.disabled = true;
        btnTest.innerHTML = '연결 확인 중...';
        const result = await GoogleSheetsSync.testConnection(url);
        btnTest.disabled = false;
        btnTest.innerHTML = '연결 테스트';

        if (result.success) {
          this.showToast(result.message, 'success');
        } else {
          this.showToast(result.message, 'error');
        }
      });
    }

    // URL 저장
    if (btnSave) {
      btnSave.addEventListener('click', () => {
        const url = inputUrl?.value?.trim() || '';
        GoogleSheetsSync.setUrl(url);
        this.updateCloudStatusBadge();
        this.showToast('구글 시트 웹앱 URL이 저장되었습니다!', 'success');
        this.closeModal('cloudModal');
      });
    }

    // 일괄 전송
    if (btnBatchSync) {
      btnBatchSync.addEventListener('click', async () => {
        if (!GoogleSheetsSync.isConnected()) {
          this.showToast('먼저 웹 앱 URL을 저장하고 연결을 완료해주세요.', 'warning');
          return;
        }
        if (confirm(`현재 저장된 ${this.records.length}건의 모든 기록을 구글 시트로 일괄 업로드하시겠습니까?`)) {
          btnBatchSync.disabled = true;
          btnBatchSync.innerHTML = '업로드 중...';
          const res = await GoogleSheetsSync.batchSyncRecords(this.records);
          btnBatchSync.disabled = false;
          btnBatchSync.innerHTML = '로컬 기록 전체 구글 시트로 올리기';

          if (res.success) {
            this.showToast(res.message, 'success');
          } else {
            this.showToast(res.message, 'error');
          }
        }
      });
    }

    // 구글 시트에서 가져오기
    if (btnPullFromSheet) {
      btnPullFromSheet.addEventListener('click', async () => {
        if (!GoogleSheetsSync.isConnected()) {
          this.showToast('먼저 웹 앱 URL을 저장해주세요.', 'warning');
          return;
        }
        btnPullFromSheet.disabled = true;
        btnPullFromSheet.innerHTML = '불러오는 중...';
        const res = await GoogleSheetsSync.fetchRecords();
        btnPullFromSheet.disabled = false;
        btnPullFromSheet.innerHTML = '구글 시트에서 가져오기';

        if (res.success && res.data) {
          if (res.data.length === 0) {
            this.showToast('구글 시트에 등록된 데이터가 없습니다.', 'info');
            return;
          }
          if (confirm(`구글 시트에서 ${res.data.length}개의 기록을 가져왔습니다. 로컬에 덮어쓰시겠습니까?`)) {
            Store.saveRecords(res.data);
            this.records = res.data;
            this.render();
            this.showToast(`${res.data.length}개 기록을 성공적으로 동기화했습니다!`, 'success');
          }
        } else {
          this.showToast(res.message, 'error');
        }
      });
    }
  },

  /**
   * 상단 네비게이션 클라우드 연결 뱃지 갱신 (Supabase & 구글 시트)
   */
  updateCloudStatusBadge() {
    const badge = document.getElementById('cloudConnectionBadge');
    if (!badge) return;

    const isSb = window.SupabaseSync && SupabaseSync.isConnected();
    const isGs = window.GoogleSheetsSync && GoogleSheetsSync.isConnected();

    if (isSb && isGs) {
      badge.innerHTML = `
        <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
          <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          ⚡ Supabase + 구글 시트 연동 중
        </span>
      `;
    } else if (isSb) {
      badge.innerHTML = `
        <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
          <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          ⚡ Supabase 클라우드 연동 중
        </span>
      `;
    } else if (isGs) {
      badge.innerHTML = `
        <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30">
          <span class="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
          📊 구글 시트 실시간 연동 중
        </span>
      `;
    } else {
      badge.innerHTML = `
        <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700 hover:text-slate-200 cursor-pointer">
          <span class="w-2 h-2 rounded-full bg-slate-500"></span>
          ☁️ 클라우드 DB 연동
        </span>
      `;
    }
  },

  /**
   * 사용자 프로필 관리 모달 렌더링
   */
  renderUserModal() {
    const container = document.getElementById('userListContainer');
    if (!container) return;

    const users = Store.getUsers();
    const currentId = Store.getCurrentUserId();

    const genderLabels = { male: '남군', female: '여군' };
    const ageLabels = {
      under_25: '만 25세 이하',
      age_26_30: '만 26~30세',
      age_31_35: '만 31~35세',
      age_36_40: '만 36~40세',
      age_41_45: '만 41~45세',
      age_46_50: '만 46~50세',
      over_51: '만 51세 이상'
    };

    const allRecords = Store.getAllRawRecords();

    container.innerHTML = users.map(user => {
      const isCurrent = user.id === currentId;
      const userRecordCount = allRecords.filter(r => (r.userName ? r.userName === user.name : user.name === '나의 기록')).length;

      return `
        <div class="flex items-center justify-between p-3 rounded-xl border transition-all ${
          isCurrent 
            ? 'bg-amber-500/10 border-amber-500/50 shadow-md shadow-amber-500/10' 
            : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-800/60'
        }">
          <button type="button" onclick="App.switchUser('${user.id}')" class="flex-1 flex items-center gap-3 text-left">
            <div class="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
              isCurrent ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-slate-300'
            }">
              <i data-lucide="${isCurrent ? 'check-circle' : 'user'}" class="w-4 h-4"></i>
            </div>
            <div>
              <div class="flex items-center gap-2">
                <span class="font-bold text-sm text-white">${user.name}</span>
                ${isCurrent ? '<span class="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">현재 사용 중</span>' : ''}
              </div>
              <p class="text-xs text-slate-400">
                ${genderLabels[user.gender] || '남군'} &bull; ${ageLabels[user.ageGroup] || '만 25세 이하'} &bull; 기록 ${userRecordCount}건
              </p>
            </div>
          </button>

          ${!isCurrent && users.length > 1 ? `
            <button type="button" onclick="App.deleteUser('${user.id}')" class="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors ml-2" title="사용자 및 해당 기록 삭제">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          ` : ''}
        </div>
      `;
    }).join('');

    if (window.lucide) {
      window.lucide.createIcons();
    }
  },

  /**
   * 사용자 전환
   */
  switchUser(userId) {
    Store.setCurrentUserId(userId);
    this.settings = Store.getSettings();
    this.initUI();
    this.render();
    this.closeModal('userModal');
    const user = Store.getCurrentUser();
    this.showToast(`'${user.name}' 프로필로 전환되었습니다.`, 'info');
  },

  /**
   * 사용자 삭제
   */
  deleteUser(userId) {
    const user = Store.getUsers().find(u => u.id === userId);
    const userName = user ? user.name : '해당 사용자';

    if (confirm(`'${userName}' 사용자와 해당 사용자의 모든 기록을 삭제하시겠습니까?`)) {
      const ok = Store.deleteUser(userId);
      if (ok) {
        this.renderUserModal();
        this.settings = Store.getSettings();
        this.initUI();
        this.render();
        this.showToast(`'${userName}' 사용자가 삭제되었습니다.`, 'info');
      }
    }
  },

  /**
   * 새 사용자 등록 폼 제출
   */
  handleAddUserSubmit(e) {
    e.preventDefault();
    const nameInput = document.getElementById('newUserName');
    const genderSelect = document.getElementById('newUserGender');
    const ageSelect = document.getElementById('newUserAgeGroup');

    const name = nameInput?.value?.trim();
    const gender = genderSelect?.value || 'male';
    const ageGroup = ageSelect?.value || 'under_25';

    if (!name) {
      this.showToast('사용자 이름을 입력해주세요.', 'warning');
      return;
    }

    const newUser = Store.addUser(name, gender, ageGroup);
    if (newUser) {
      nameInput.value = '';
      this.settings = Store.getSettings();
      this.initUI();
      this.render();
      this.closeModal('userModal');
      this.showToast(`새 사용자 '${newUser.name}'(으)로 등록 및 전환되었습니다!`, 'success');
    }
  },

  /**
   * 모달 열기/닫기 헬퍼
   */
  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      if (modalId === 'userModal') {
        this.renderUserModal();
      } else if (modalId === 'recordModal') {
        const currentUser = Store.getCurrentUser();
        const targetBadge = document.getElementById('recordTargetUserBadge');
        if (targetBadge) targetBadge.textContent = currentUser.name;
      }
      modal.classList.remove('hidden');
      document.body.classList.add('overflow-hidden');
      if (window.lucide) {
        window.lucide.createIcons();
      }
    }
  },

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('hidden');
      document.body.classList.remove('overflow-hidden');
    }
  },

  /**
   * 토스트 알림 메시지 표시
   */
  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    const bgColors = {
      success: 'bg-emerald-950 border-emerald-500/50 text-emerald-200',
      error: 'bg-red-950 border-red-500/50 text-red-200',
      warning: 'bg-amber-950 border-amber-500/50 text-amber-200',
      info: 'bg-slate-900 border-slate-700 text-slate-200'
    };

    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };

    toast.className = `flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-xl text-sm transition-all duration-300 transform translate-y-2 opacity-0 ${bgColors[type] || bgColors.info}`;
    toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span> <span>${message}</span>`;

    container.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.remove('translate-y-2', 'opacity-0');
    });

    setTimeout(() => {
      toast.classList.add('opacity-0', 'translate-y-2');
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }
};

window.App = App;
