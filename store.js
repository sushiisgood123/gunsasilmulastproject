/**
 * 데이터 저장 및 상태 관리 모듈 (개개인별 다중 프로필 + LocalStorage)
 */

const Store = {
  KEYS: {
    SETTINGS: 'milifit_settings',
    RECORDS: 'milifit_records',
    USERS: 'milifit_users',
    CURRENT_USER_ID: 'milifit_current_user_id'
  },

  /* ---------------------------------------------------------
   * 사용자 프로필 관리 (개개인별 분리 기능)
   * --------------------------------------------------------- */
  getDefaultUsers() {
    return [
      {
        id: 'user_default',
        name: '나의 기록',
        gender: 'male',
        ageGroup: 'under_25',
        created_at: new Date().toISOString()
      }
    ];
  },

  getUsers() {
    try {
      const data = localStorage.getItem(this.KEYS.USERS);
      if (!data) {
        const defaults = this.getDefaultUsers();
        this.saveUsers(defaults);
        return defaults;
      }
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : this.getDefaultUsers();
    } catch {
      return this.getDefaultUsers();
    }
  },

  saveUsers(users) {
    localStorage.setItem(this.KEYS.USERS, JSON.stringify(users));
  },

  getCurrentUserId() {
    return localStorage.getItem(this.KEYS.CURRENT_USER_ID) || 'user_default';
  },

  getCurrentUser() {
    const users = this.getUsers();
    const currentId = this.getCurrentUserId();
    const found = users.find(u => u.id === currentId);
    if (found) return found;

    // 없으면 첫 번째 사용자 선택
    const first = users[0] || this.getDefaultUsers()[0];
    this.setCurrentUserId(first.id);
    return first;
  },

  setCurrentUserId(userId) {
    localStorage.setItem(this.KEYS.CURRENT_USER_ID, userId);
    // 현재 사용자의 성별 및 연령대를 설정에 자동 반영
    const user = this.getUsers().find(u => u.id === userId);
    if (user) {
      this.saveSettings({ gender: user.gender, ageGroup: user.ageGroup });
    }
  },

  addUser(name, gender = 'male', ageGroup = 'under_25') {
    const users = this.getUsers();
    const cleanName = (name || '').trim();
    if (!cleanName) return null;

    // 이미 같은 이름이 있는지 확인
    let existing = users.find(u => u.name === cleanName);
    if (existing) {
      this.setCurrentUserId(existing.id);
      return existing;
    }

    const newUser = {
      id: 'user_' + Date.now(),
      name: cleanName,
      gender: gender,
      ageGroup: ageGroup,
      created_at: new Date().toISOString()
    };

    users.push(newUser);
    this.saveUsers(users);
    this.setCurrentUserId(newUser.id);
    return newUser;
  },

  deleteUser(userId) {
    let users = this.getUsers();
    if (users.length <= 1) return false; // 최소 1명은 유지

    const targetUser = users.find(u => u.id === userId);
    users = users.filter(u => u.id !== userId);
    this.saveUsers(users);

    // 해당 사용자의 기록도 정리
    if (targetUser) {
      let allRecords = this.getAllRawRecords();
      allRecords = allRecords.filter(r => r.userName !== targetUser.name && r.userId !== userId);
      this.saveAllRawRecords(allRecords);
    }

    // 현재 사용자가 삭제된 경우 첫 번째 사용자로 전환
    if (this.getCurrentUserId() === userId) {
      this.setCurrentUserId(users[0].id);
    }

    return true;
  },

  /* ---------------------------------------------------------
   * 기본 설정 관리
   * --------------------------------------------------------- */
  getDefaultSettings() {
    const currentUser = this.getCurrentUser();
    return {
      gender: currentUser.gender || 'male',
      ageGroup: currentUser.ageGroup || 'under_25',
      targetGrade: 'special',
      targetWeight: 78.0
    };
  },

  getSettings() {
    try {
      const data = localStorage.getItem(this.KEYS.SETTINGS);
      const currentUser = this.getCurrentUser();
      const defaults = {
        gender: currentUser.gender || 'male',
        ageGroup: currentUser.ageGroup || 'under_25',
        targetGrade: 'special',
        targetWeight: 78.0
      };
      return data ? { ...defaults, ...JSON.parse(data) } : defaults;
    } catch {
      return this.getDefaultSettings();
    }
  },

  saveSettings(settings) {
    const current = this.getSettings();
    const updated = { ...current, ...settings };
    localStorage.setItem(this.KEYS.SETTINGS, JSON.stringify(updated));

    // 현재 사용자 프로필에도 성별/연령대 동기화
    const users = this.getUsers();
    const currentId = this.getCurrentUserId();
    const userIndex = users.findIndex(u => u.id === currentId);
    if (userIndex !== -1) {
      if (settings.gender) users[userIndex].gender = settings.gender;
      if (settings.ageGroup) users[userIndex].ageGroup = settings.ageGroup;
      this.saveUsers(users);
    }

    return updated;
  },

  /* ---------------------------------------------------------
   * 측정 기록 관리 (현재 사용자 필터링)
   * --------------------------------------------------------- */
  getAllRawRecords() {
    try {
      const data = localStorage.getItem(this.KEYS.RECORDS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveAllRawRecords(records) {
    localStorage.setItem(this.KEYS.RECORDS, JSON.stringify(records));
  },

  /**
   * 현재 활성화된 사용자의 기록만 가져오기
   */
  getRecords(filterUserName) {
    const currentUser = this.getCurrentUser();
    const targetName = filterUserName || currentUser.name;
    const all = this.getAllRawRecords();

    // userName이 없는 구 버전 기록은 '나의 기록' 소유로 간주
    const userRecords = all.filter(r => {
      if (r.userName) return r.userName === targetName;
      return targetName === '나의 기록';
    });

    // 날짜 오름차순(과거 -> 최신) 정렬
    return userRecords.sort((a, b) => new Date(a.date) - new Date(b.date));
  },

  saveRecords(recordsForCurrentUser) {
    const currentUser = this.getCurrentUser();
    let all = this.getAllRawRecords();

    // 현재 사용자가 아닌 다른 사용자의 기록은 보존
    const others = all.filter(r => {
      if (r.userName) return r.userName !== currentUser.name;
      return currentUser.name !== '나의 기록';
    });

    // 현재 사용자 레코드에 userName 및 userId 주입
    const updatedUserRecords = recordsForCurrentUser.map(r => ({
      ...r,
      userName: r.userName || currentUser.name,
      userId: r.userId || currentUser.id
    }));

    this.saveAllRawRecords([...others, ...updatedUserRecords]);
  },

  addRecord(record) {
    const currentUser = this.getCurrentUser();
    const all = this.getAllRawRecords();

    const newRecord = {
      id: record.id || ('rec_' + Date.now()),
      created_at: new Date().toISOString(),
      userId: currentUser.id,
      userName: currentUser.name,
      date: record.date || new Date().toISOString().split('T')[0],
      weight: parseFloat(record.weight) || 0,
      runMin: parseInt(record.runMin, 10) || 0,
      runSecOnly: parseInt(record.runSecOnly, 10) || 0,
      runSec: record.runSec || (parseInt(record.runMin, 10) * 60 + parseInt(record.runSecOnly, 10)),
      pushup: parseInt(record.pushup, 10) || 0,
      situp: parseInt(record.situp, 10) || 0,
      overallGrade: record.overallGrade || '',
      notes: record.notes || '',
      syncedWithSheet: Boolean(record.syncedWithSheet),
      syncedWithSupabase: Boolean(record.syncedWithSupabase)
    };

    all.push(newRecord);
    this.saveAllRawRecords(all);
    return newRecord;
  },

  updateRecord(id, updatedFields) {
    const all = this.getAllRawRecords();
    const index = all.findIndex(r => r.id === id);
    if (index !== -1) {
      all[index] = { ...all[index], ...updatedFields };
      this.saveAllRawRecords(all);
      return all[index];
    }
    return null;
  },

  deleteRecord(id) {
    let all = this.getAllRawRecords();
    all = all.filter(r => r.id !== id);
    this.saveAllRawRecords(all);
    return this.getRecords();
  },

  clearAllRecordsForCurrentUser() {
    const currentUser = this.getCurrentUser();
    let all = this.getAllRawRecords();
    all = all.filter(r => r.userName !== currentUser.name && r.userId !== currentUser.id);
    this.saveAllRawRecords(all);
  },

  clearAllRecords() {
    localStorage.removeItem(this.KEYS.RECORDS);
  },

  /**
   * 클라우드(Supabase/구글시트)에서 가져온 다중 사용자 레코드 일괄 동기화
   */
  syncRecordsFromCloud(cloudRecords) {
    if (!Array.isArray(cloudRecords)) return;
    const users = this.getUsers();
    cloudRecords.forEach(r => {
      const uName = (r.userName || '').trim();
      if (uName && !users.find(u => u.name === uName)) {
        users.push({
          id: 'user_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          name: uName,
          gender: 'male',
          ageGroup: 'under_25',
          created_at: new Date().toISOString()
        });
      }
    });
    this.saveUsers(users);
    this.saveAllRawRecords(cloudRecords);
  },

  loadSampleData() {
    const currentUser = this.getCurrentUser();
    const sample = [
      {
        id: 'rec_sample_1',
        created_at: '2026-09-01T08:00:00.000Z',
        userId: currentUser.id,
        userName: currentUser.name,
        date: '2026-09-01',
        weight: 88.0,
        runMin: 15,
        runSecOnly: 20,
        runSec: 920,
        pushup: 48,
        situp: 62,
        overallGrade: '불합격',
        notes: '체력단련 1일차 시작! 체중 88kg',
        syncedWithSheet: false
      },
      {
        id: 'rec_sample_2',
        created_at: '2026-09-15T08:00:00.000Z',
        userId: currentUser.id,
        userName: currentUser.name,
        date: '2026-09-15',
        weight: 87.1,
        runMin: 14,
        runSecOnly: 45,
        runSec: 885,
        pushup: 52,
        situp: 70,
        overallGrade: '3급',
        notes: '2주차: 윗몸일으키기 3급 달성',
        syncedWithSheet: false
      },
      {
        id: 'rec_sample_3',
        created_at: '2026-10-01T08:00:00.000Z',
        userId: currentUser.id,
        userName: currentUser.name,
        date: '2026-10-01',
        weight: 85.8,
        runMin: 14,
        runSecOnly: 10,
        runSec: 850,
        pushup: 58,
        situp: 75,
        overallGrade: '2급',
        notes: '4주차: 전 종목 2급 진입!',
        syncedWithSheet: false
      },
      {
        id: 'rec_sample_4',
        created_at: '2026-10-18T08:00:00.000Z',
        userId: currentUser.id,
        userName: currentUser.name,
        date: '2026-10-18',
        weight: 84.4,
        runMin: 13,
        runSecOnly: 35,
        runSec: 815,
        pushup: 63,
        situp: 80,
        overallGrade: '2급',
        notes: '6주차: 3km 13분대 돌파',
        syncedWithSheet: false
      },
      {
        id: 'rec_sample_5',
        created_at: '2026-11-05T08:00:00.000Z',
        userId: currentUser.id,
        userName: currentUser.name,
        date: '2026-11-05',
        weight: 83.0,
        runMin: 13,
        runSecOnly: 0,
        runSec: 780,
        pushup: 66,
        situp: 86,
        overallGrade: '1급',
        notes: '최신 측정: 윗몸일으키기 특급 달성! 특급전사까지 뜀걸음 30초, 팔굽 6개!',
        syncedWithSheet: false
      }
    ];

    this.saveRecords(sample);
    return sample;
  },

  exportCSV() {
    const records = this.getRecords();
    const currentUser = this.getCurrentUser();
    if (!records.length) return null;

    const headers = ['사용자', '측정일자', '체중(kg)', '3km뜀걸음', '3km초', '팔굽혀펴기(회)', '윗몸일으키기(회)', '종합등급', '메모'];
    const rows = records.map(r => [
      `"${r.userName || currentUser.name}"`,
      r.date,
      r.weight,
      ArmyStandards.formatSecondsToMinSec(r.runSec),
      r.runSec,
      r.pushup,
      r.situp,
      `"${(r.overallGrade || '').replace(/"/g, '""')}"`,
      `"${(r.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `밀리핏_${currentUser.name}_체력기록_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  }
};

window.Store = Store;
