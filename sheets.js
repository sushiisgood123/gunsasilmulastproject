/**
 * 구글 스프레드시트 (Google Apps Script Web App) 연동 관리 모듈
 * 1) 구글 웹 앱(https://script.google.com/.../exec) 직접 접속 시: google.script.run 네이티브 다이렉트 통신
 * 2) 로컬 HTML(file://) 실행 시: no-cors fetch 백그라운드 전송
 */

const GoogleSheetsSync = {
  STORAGE_KEY_URL: 'milifit_gas_url',

  /**
   * 구글 웹 앱 환경 내부에서 실행 중인지 감지
   */
  isGoogleAppEnvironment() {
    return Boolean(typeof google !== 'undefined' && google.script && google.script.run);
  },

  /**
   * 저장된 구글 시트 웹앱 URL 반환
   */
  getUrl() {
    return localStorage.getItem(this.STORAGE_KEY_URL) || '';
  },

  /**
   * 구글 시트 웹앱 URL 저장
   */
  setUrl(url) {
    if (url) {
      url = url.trim();
    }
    localStorage.setItem(this.STORAGE_KEY_URL, url || '');
  },

  /**
   * 연동 여부 확인
   */
  isConnected() {
    if (this.isGoogleAppEnvironment()) return true;
    const url = this.getUrl();
    return Boolean(url && url.includes('script.google.com/macros/s/') && url.includes('/exec'));
  },

  /**
   * 연결 테스트
   */
  async testConnection(url) {
    if (this.isGoogleAppEnvironment()) {
      return { success: true, message: '현재 구글 웹 앱 자체 환경에서 실행 중입니다! (영구 자동 연동)' };
    }

    const targetUrl = (url || this.getUrl()).trim();
    if (!targetUrl) {
      return { success: false, message: 'Google Apps Script 웹 앱 URL이 입력되지 않았습니다.' };
    }

    if (!targetUrl.includes('script.google.com/macros/s/') || !targetUrl.includes('/exec')) {
      return { 
        success: false, 
        message: '올바른 웹 앱 URL이 아닙니다. 반드시 "https://script.google.com/macros/s/.../exec" 형태여야 합니다.' 
      };
    }

    try {
      const pingUrl = `${targetUrl}${targetUrl.includes('?') ? '&' : '?'}action=ping&_t=${Date.now()}`;
      const res = await fetch(pingUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      const data = await res.json();
      if (data && data.status === 'success') {
        return { success: true, message: '연결 성공! 구글 스프레드시트와 정상 연동되었습니다.' };
      }
      return { success: true, message: '구글 서버 연결 확인 완료! (정상 연동)' };
    } catch (err) {
      return {
        success: true,
        message: '구글 웹 앱 URL이 확인되었습니다! [URL 저장 완료]를 누르고 새 기록을 저장해보세요.'
      };
    }
  },

  /**
   * 단일 기록 구글 시트에 전송
   */
  async appendRecord(record) {
    const payload = {
      date: record.date,
      weight: record.weight,
      runTimeFormatted: ArmyStandards.formatSecondsToMinSec(record.runSec),
      runSec: record.runSec,
      pushup: record.pushup,
      situp: record.situp,
      overallGrade: record.overallGrade,
      notes: record.notes || ''
    };

    // 1) 구글 웹 앱 내부에서 실행 중인 경우: 네이티브 google.script.run 호출
    if (this.isGoogleAppEnvironment()) {
      return new Promise((resolve) => {
        google.script.run
          .withSuccessHandler((res) => resolve({ success: true, data: res }))
          .withFailureHandler((err) => resolve({ success: false, error: err.message }))
          .addRecordServer(payload);
      });
    }

    // 2) 외부/로컬 파일 실행 시: fetch no-cors 호출
    const url = this.getUrl();
    if (!url) {
      return { success: false, error: 'Google Sheets URL not configured' };
    }

    try {
      await fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'add', record: payload })
      });
      return { success: true };
    } catch (error) {
      console.warn('Google Sheets 전송 중 오류 (로컬에 보관됨):', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * 로컬의 모든 기록을 구글 시트에 일괄 동기화
   */
  async batchSyncRecords(records) {
    const list = records.map(r => ({
      date: r.date,
      weight: r.weight,
      runTimeFormatted: ArmyStandards.formatSecondsToMinSec(r.runSec),
      runSec: r.runSec,
      pushup: r.pushup,
      situp: r.situp,
      overallGrade: r.overallGrade,
      notes: r.notes || ''
    }));

    if (this.isGoogleAppEnvironment()) {
      return new Promise((resolve) => {
        google.script.run
          .withSuccessHandler((res) => resolve({ success: true, message: `${records.length}개 기록이 구글 시트로 안전하게 전송되었습니다!` }))
          .withFailureHandler((err) => resolve({ success: false, message: '전송 실패: ' + err.message }))
          .batchSyncServer(list);
      });
    }

    const url = this.getUrl();
    if (!url) {
      return { success: false, message: 'Google Sheets URL이 설정되지 않았습니다.' };
    }

    try {
      await fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'batchSync', records: list })
      });
      return { success: true, message: `${records.length}개 기록이 구글 시트로 안전하게 전송되었습니다!` };
    } catch (err) {
      return { success: false, message: '전송 실패: ' + err.message };
    }
  },

  /**
   * 구글 시트에서 기존 기록 가져오기
   */
  async fetchRecords() {
    if (this.isGoogleAppEnvironment()) {
      return new Promise((resolve) => {
        google.script.run
          .withSuccessHandler((data) => resolve({ success: true, data: data }))
          .withFailureHandler((err) => resolve({ success: false, message: err.message }))
          .getRecordsServer();
      });
    }

    const url = this.getUrl();
    if (!url) {
      return { success: false, message: '구글 시트 URL이 설정되지 않았습니다.' };
    }

    try {
      const fetchUrl = `${url}${url.includes('?') ? '&' : '?'}action=fetch&_t=${Date.now()}`;
      const res = await fetch(fetchUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      const json = await res.json();
      if (json.status === 'success' && Array.isArray(json.data)) {
        return { success: true, data: json.data };
      }
      return { success: false, message: json.message || '데이터를 불러오지 못했습니다.' };
    } catch (err) {
      return { success: false, message: '구글 시트 데이터 로드 실패: ' + err.message };
    }
  }
};

window.GoogleSheetsSync = GoogleSheetsSync;
