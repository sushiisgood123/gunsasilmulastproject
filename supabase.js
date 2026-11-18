/**
 * Supabase 데이터베이스 연동 관리 모듈
 * CDN: @supabase/supabase-js
 */

const SupabaseSync = {
  STORAGE_KEY_URL: 'milifit_supabase_url',
  STORAGE_KEY_KEY: 'milifit_supabase_key',
  client: null,

  getUrl() {
    return (localStorage.getItem(this.STORAGE_KEY_URL) || '').trim();
  },

  getKey() {
    return (localStorage.getItem(this.STORAGE_KEY_KEY) || '').trim();
  },

  setCredentials(url, key) {
    localStorage.setItem(this.STORAGE_KEY_URL, (url || '').trim());
    localStorage.setItem(this.STORAGE_KEY_KEY, (key || '').trim());
    this.client = null; // 인스턴스 리셋
  },

  getClient() {
    if (this.client) return this.client;
    const url = this.getUrl();
    const key = this.getKey();

    if (url && key && window.supabase && typeof window.supabase.createClient === 'function') {
      try {
        this.client = window.supabase.createClient(url, key);
        return this.client;
      } catch (err) {
        console.error('Supabase 클라이언트 생성 실패:', err);
        return null;
      }
    }
    return null;
  },

  isConnected() {
    const url = this.getUrl();
    const key = this.getKey();
    return Boolean(url && key && url.startsWith('https://') && url.includes('.supabase.co'));
  },

  /**
   * Supabase 연결 테스트
   */
  async testConnection(url, key) {
    const targetUrl = (url || this.getUrl()).trim();
    const targetKey = (key || this.getKey()).trim();

    if (!targetUrl || !targetKey) {
      return { success: false, message: 'Supabase Project URL과 Anon API Key를 모두 입력해주세요.' };
    }

    if (!window.supabase) {
      return { success: false, message: 'Supabase 라이브러리를 불러오지 못했습니다. 인터넷 연결을 확인해주세요.' };
    }

    try {
      const testClient = window.supabase.createClient(targetUrl, targetKey);
      const { data, error } = await testClient
        .from('milifit_records')
        .select('id')
        .limit(1);

      if (error) {
        if (error.code === '42P01') {
          return {
            success: false,
            message: '연결은 되었으나 milifit_records 테이블이 없습니다. 제공된 SQL을 Supabase SQL Editor에서 실행해주세요!'
          };
        }
        return { success: false, message: '연결 실패: ' + error.message };
      }

      return { success: true, message: '성공! Supabase 데이터베이스와 정상적으로 연결되었습니다.' };
    } catch (err) {
      return { success: false, message: '연결 중 오류 발생: ' + err.message };
    }
  },

  /**
   * Supabase에서 모든 기록 불러오기
   */
  async fetchRecords() {
    const client = this.getClient();
    if (!client) {
      return { success: false, message: 'Supabase가 설정되지 않았습니다.' };
    }

    try {
      const { data, error } = await client
        .from('milifit_records')
        .select('*')
        .order('date', { ascending: true });

      if (error) {
        return { success: false, message: error.message };
      }

      const records = (data || []).map(row => ({
        id: row.id,
        created_at: row.created_at,
        userName: row.user_name || '나의 기록',
        date: row.date,
        weight: parseFloat(row.weight) || 0,
        runMin: row.run_min || Math.floor(row.run_sec / 60),
        runSecOnly: row.run_sec_only || (row.run_sec % 60),
        runSec: row.run_sec,
        pushup: row.pushup || 0,
        situp: row.situp || 0,
        overallGrade: row.overall_grade || '',
        notes: row.notes || '',
        syncedWithSupabase: true
      }));

      return { success: true, data: records };
    } catch (err) {
      return { success: false, message: err.message };
    }
  },

  /**
   * 단일 기록 Supabase에 저장
   */
  async insertRecord(record) {
    const client = this.getClient();
    if (!client) return { success: false, error: 'Not connected' };

    const payload = {
      user_name: record.userName || '나의 기록',
      date: record.date,
      weight: record.weight,
      run_min: record.runMin,
      run_sec_only: record.runSecOnly,
      run_sec: record.runSec,
      pushup: record.pushup,
      situp: record.situp,
      overall_grade: record.overallGrade,
      notes: record.notes || ''
    };

    try {
      const { data, error } = await client
        .from('milifit_records')
        .insert([payload])
        .select();

      if (error) {
        console.warn('Supabase 저장 실패:', error);
        return { success: false, error: error.message };
      }

      return { success: true, data: data[0] };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  /**
   * 단일 기록 Supabase에서 삭제
   */
  async deleteRecord(id) {
    const client = this.getClient();
    if (!client) return { success: false };

    try {
      const { error } = await client
        .from('milifit_records')
        .delete()
        .eq('id', id);

      return { success: !error };
    } catch {
      return { success: false };
    }
  },

  /**
   * 로컬 기록 전체를 Supabase에 일괄 업로드
   */
  async syncAllLocalToSupabase(records) {
    const client = this.getClient();
    if (!client) return { success: false, message: 'Supabase가 설정되지 않았습니다.' };

    const payloads = records.map(r => ({
      user_name: r.userName || '나의 기록',
      date: r.date,
      weight: r.weight,
      run_min: r.runMin || Math.floor(r.runSec / 60),
      run_sec_only: r.runSecOnly || (r.runSec % 60),
      run_sec: r.runSec,
      pushup: r.pushup || 0,
      situp: r.situp || 0,
      overall_grade: r.overallGrade || '',
      notes: r.notes || ''
    }));

    try {
      const { error } = await client
        .from('milifit_records')
        .insert(payloads);

      if (error) {
        return { success: false, message: error.message };
      }
      return { success: true, message: `${records.length}건이 Supabase에 성공적으로 백업되었습니다!` };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }
};

window.SupabaseSync = SupabaseSync;

