/**
 * Chart.js 기반 성장 시각화 모듈
 * - 뜀걸음: 축 반전(reverse: true)을 적용하여 시간이 단축될수록 우상향!
 * - 맨몸운동(팔굽, 윗몸): 횟수가 증가할수록 우상향!
 * - 모든 지표가 단련될수록 우상향하는 통일된 성취감 시각화
 */

const FitnessCharts = {
  mainChart: null,

  init(records, settings) {
    this.renderMainProgressChart(records, settings);
  },

  update(records, settings) {
    this.renderMainProgressChart(records, settings);
  },

  /**
   * 3대 종목 통합 우상향 성장 차트:
   * 맨몸운동(좌측 Y축, 회)은 개수 증가로 우상향,
   * 뜀걸음(우측 Y축, 분:초)은 축 반전(reverse: true)으로 시간 단축 시 우상향!
   */
  renderMainProgressChart(records, settings) {
    const canvas = document.getElementById('mainProgressChart');
    const emptyState = document.getElementById('chartEmptyState');
    if (!canvas) return;

    if (this.mainChart) {
      this.mainChart.destroy();
      this.mainChart = null;
    }

    if (!records || records.length === 0) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (emptyState) emptyState.classList.remove('hidden');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    const labels = records.map(r => r.date);
    const pushupData = records.map(r => r.pushup);
    const situpData = records.map(r => r.situp);
    const runData = records.map(r => r.runSec); // 초 단위

    // 현재 설정 연령대 특급 기준선
    const genderStd = ArmyStandards.ARMY_STANDARDS[settings.gender || 'male'] || ArmyStandards.ARMY_STANDARDS.male;
    const std = genderStd[settings.ageGroup || 'under_25'] || genderStd.under_25;

    const ctx = canvas.getContext('2d');
    this.mainChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: '윗몸일으키기 (회)',
            data: situpData,
            borderColor: '#3B82F6', // Blue
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderWidth: 3,
            tension: 0.3,
            pointRadius: 6,
            pointHoverRadius: 8,
            pointBackgroundColor: '#3B82F6',
            yAxisID: 'yReps',
            fill: false
          },
          {
            label: '팔굽혀펴기 (회)',
            data: pushupData,
            borderColor: '#10B981', // Emerald
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            borderWidth: 3,
            tension: 0.3,
            pointRadius: 6,
            pointHoverRadius: 8,
            pointBackgroundColor: '#10B981',
            yAxisID: 'yReps',
            fill: false
          },
          {
            label: '3km 뜀걸음 (단축될수록 상향 ↑)',
            data: runData,
            borderColor: '#F59E0B', // Amber
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            borderWidth: 3.5,
            tension: 0.3,
            pointRadius: 6,
            pointHoverRadius: 8,
            pointBackgroundColor: '#F59E0B',
            pointBorderColor: '#FFF',
            pointBorderWidth: 2,
            yAxisID: 'yRun',
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              color: '#94A3B8',
              font: { family: "'Pretendard', sans-serif", size: 12, weight: 'bold' },
              usePointStyle: true,
              padding: 16
            }
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            titleColor: '#F8FAFC',
            bodyColor: '#E2E8F0',
            borderColor: '#334155',
            borderWidth: 1,
            padding: 12,
            bodySpacing: 6,
            callbacks: {
              label: function(context) {
                if (context.dataset.yAxisID === 'yRun') {
                  const sec = context.raw;
                  return ` 🏃 3km 뜀걸음: ${ArmyStandards.formatSecondsToMinSec(sec)} (특급기준: ${ArmyStandards.formatSecondsToMinSec(std.run3k.special)})`;
                } else if (context.datasetIndex === 0) {
                  return ` 🧘 윗몸일으키기: ${context.raw}회 (특급기준: ${std.situp.special}회)`;
                } else {
                  return ` 💪 팔굽혀펴기: ${context.raw}회 (특급기준: ${std.pushup.special}회)`;
                }
              },
              afterBody: function(contexts) {
                const index = contexts[0].dataIndex;
                const rec = records[index];
                if (rec && rec.overallGrade) {
                  return [` 🎖️ 종합 등급: ${rec.overallGrade}`, ` ⚖️ 측정 체중: ${rec.weight} kg`];
                }
                return [];
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#94A3B8', font: { family: "'Pretendard', sans-serif" } }
          },
          yReps: {
            type: 'linear',
            position: 'left',
            title: {
              display: true,
              text: '맨몸운동 횟수 (회)',
              color: '#10B981',
              font: { weight: 'bold' }
            },
            grid: { color: 'rgba(255, 255, 255, 0.06)' },
            ticks: {
              color: '#94A3B8',
              stepSize: 10
            },
            min: Math.max(0, Math.min(...pushupData, ...situpData) - 10)
          },
          yRun: {
            type: 'linear',
            position: 'right',
            reverse: true, // 축 반전: 달리기 시간이 단축될수록(초가 작을수록) 상향 곡선 형성!
            title: {
              display: true,
              text: '3km 뜀걸음 (단축될수록 상향 ↑)',
              color: '#F59E0B',
              font: { weight: 'bold' }
            },
            grid: { drawOnChartArea: false }, // 좌우 축 그리드 겹침 방지
            ticks: {
              color: '#F59E0B',
              callback: function(val) {
                const m = Math.floor(val / 60);
                const s = Math.round(val % 60);
                return `${m}:${s < 10 ? '0' : ''}${s}`;
              }
            }
          }
        }
      }
    });
  }
};

window.FitnessCharts = FitnessCharts;
