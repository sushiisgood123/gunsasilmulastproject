/**
 * 육군 체력검정 기준표 및 등급 산출 모듈
 * 국방부 부대관리훈령 별표 31 체력검정 기준표 기반
 */

const ARMY_STANDARDS = {
  male: {
    under_25: {
      label: "만 25세 이하",
      pushup: { special: 72, g1: 64, g2: 56, g3: 48 }, // 회 이상
      situp: { special: 86, g1: 82, g2: 76, g3: 70 },  // 회 이상
      run3k: { special: 750, g1: 812, g2: 874, g3: 936 } // 초 이하 (12:30, 13:32, 14:34, 15:36)
    },
    age_26_30: {
      label: "만 26 ~ 30세",
      pushup: { special: 70, g1: 62, g2: 54, g3: 46 },
      situp: { special: 84, g1: 80, g2: 74, g3: 68 },
      run3k: { special: 765, g1: 832, g2: 899, g3: 965 } // (12:45, 13:52, 14:59, 16:05)
    },
    age_31_35: {
      label: "만 31 ~ 35세",
      pushup: { special: 68, g1: 60, g2: 52, g3: 44 },
      situp: { special: 82, g1: 78, g2: 72, g3: 66 },
      run3k: { special: 780, g1: 852, g2: 924, g3: 995 } // (13:00, 14:12, 15:24, 16:35)
    },
    age_36_40: {
      label: "만 36 ~ 40세",
      pushup: { special: 65, g1: 57, g2: 49, g3: 41 },
      situp: { special: 79, g1: 75, g2: 69, g3: 63 },
      run3k: { special: 795, g1: 872, g2: 949, g3: 1025 } // (13:15, 14:32, 15:49, 17:05)
    },
    age_41_45: {
      label: "만 41 ~ 45세",
      pushup: { special: 61, g1: 53, g2: 45, g3: 37 },
      situp: { special: 75, g1: 71, g2: 65, g3: 59 },
      run3k: { special: 820, g1: 900, g2: 980, g3: 1060 } // (13:40, 15:00, 16:20, 17:40)
    },
    age_46_50: {
      label: "만 46 ~ 50세",
      pushup: { special: 56, g1: 48, g2: 40, g3: 32 },
      situp: { special: 70, g1: 66, g2: 60, g3: 54 },
      run3k: { special: 850, g1: 935, g2: 1020, g3: 1105 } // (14:10, 15:35, 17:00, 18:25)
    },
    over_51: {
      label: "만 51세 이상",
      pushup: { special: 50, g1: 42, g2: 34, g3: 26 },
      situp: { special: 64, g1: 60, g2: 54, g3: 48 },
      run3k: { special: 885, g1: 975, g2: 1065, g3: 1155 } // (14:45, 16:15, 17:45, 19:15)
    }
  },
  female: {
    under_25: {
      label: "만 25세 이하",
      pushup: { special: 35, g1: 31, g2: 27, g3: 23 },
      situp: { special: 71, g1: 65, g2: 59, g3: 53 },
      run3k: { special: 900, g1: 962, g2: 1024, g3: 1086 } // (15:00, 16:02, 17:04, 18:06)
    },
    age_26_30: {
      label: "만 26 ~ 30세",
      pushup: { special: 33, g1: 29, g2: 25, g3: 21 },
      situp: { special: 69, g1: 63, g2: 57, g3: 51 },
      run3k: { special: 920, g1: 985, g2: 1050, g3: 1115 } // (15:20, 16:25, 17:30, 18:35)
    },
    age_31_35: {
      label: "만 31 ~ 35세",
      pushup: { special: 31, g1: 27, g2: 23, g3: 19 },
      situp: { special: 67, g1: 61, g2: 55, g3: 49 },
      run3k: { special: 945, g1: 1015, g2: 1085, g3: 1155 } // (15:45, 16:55, 18:05, 19:15)
    },
    age_36_40: {
      label: "만 36 ~ 40세",
      pushup: { special: 28, g1: 24, g2: 20, g3: 16 },
      situp: { special: 64, g1: 58, g2: 52, g3: 46 },
      run3k: { special: 975, g1: 1050, g2: 1125, g3: 1200 } // (16:15, 17:30, 18:45, 20:00)
    },
    age_41_45: {
      label: "만 41 ~ 45세",
      pushup: { special: 25, g1: 21, g2: 17, g3: 13 },
      situp: { special: 60, g1: 54, g2: 48, g3: 42 },
      run3k: { special: 1005, g1: 1085, g2: 1165, g3: 1245 }
    },
    age_46_50: {
      label: "만 46 ~ 50세",
      pushup: { special: 22, g1: 18, g2: 14, g3: 10 },
      situp: { special: 55, g1: 49, g2: 43, g3: 37 },
      run3k: { special: 1040, g1: 1125, g2: 1210, g3: 1295 }
    },
    over_51: {
      label: "만 51세 이상",
      pushup: { special: 18, g1: 14, g2: 10, g3: 7 },
      situp: { special: 49, g1: 43, g2: 37, g3: 31 },
      run3k: { special: 1080, g1: 1170, g2: 1260, g3: 1350 }
    }
  }
};

const GRADE_ORDER = {
  special: { level: 4, label: "특급", badgeClass: "badge-special", color: "#F59E0B" },
  g1: { level: 3, label: "1급", badgeClass: "badge-g1", color: "#10B981" },
  g2: { level: 2, label: "2급", badgeClass: "badge-g2", color: "#3B82F6" },
  g3: { level: 1, label: "3급", badgeClass: "badge-g3", color: "#F97316" },
  fail: { level: 0, label: "불합격", badgeClass: "badge-fail", color: "#EF4444" }
};

/**
 * 초(seconds)를 mm:ss 형식으로 포맷팅
 */
function formatSecondsToMinSec(seconds) {
  if (isNaN(seconds) || seconds === null) return "00:00";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}분 ${s < 10 ? '0' : ''}${s}초`;
}

/**
 * 분과 초를 초 단위로 환산
 */
function toSeconds(minutes, seconds) {
  return (parseInt(minutes, 10) || 0) * 60 + (parseInt(seconds, 10) || 0);
}

/**
 * 특정 단일 종목의 등급을 계산
 * @param {string} eventType 'pushup' | 'situp' | 'run3k'
 * @param {number} value 회수(개) 또는 뜀걸음 시간(초)
 * @param {object} standard 해당 연령대의 기준표
 */
function evaluateEvent(eventType, value, standard) {
  const std = standard[eventType];
  if (!std) return { grade: 'fail', level: 0, label: '불합격' };

  if (eventType === 'run3k') {
    // 뜀걸음은 시간이 작을수록 좋음
    if (value <= std.special) return { grade: 'special', ...GRADE_ORDER.special };
    if (value <= std.g1) return { grade: 'g1', ...GRADE_ORDER.g1 };
    if (value <= std.g2) return { grade: 'g2', ...GRADE_ORDER.g2 };
    if (value <= std.g3) return { grade: 'g3', ...GRADE_ORDER.g3 };
    return { grade: 'fail', ...GRADE_ORDER.fail };
  } else {
    // 팔굽혀펴기, 윗몸일으키기는 개수가 클수록 좋음
    if (value >= std.special) return { grade: 'special', ...GRADE_ORDER.special };
    if (value >= std.g1) return { grade: 'g1', ...GRADE_ORDER.g1 };
    if (value >= std.g2) return { grade: 'g2', ...GRADE_ORDER.g2 };
    if (value >= std.g3) return { grade: 'g3', ...GRADE_ORDER.g3 };
    return { grade: 'fail', ...GRADE_ORDER.fail };
  }
}

/**
 * 종합 평가 및 목표(특급 / 차상위급) 갭 계산
 * 규정: 세 종목 중 가장 낮은 종목의 등급이 최종 종합 등급
 */
function evaluateFitness(gender = 'male', ageGroup = 'under_25', runSec, pushup, situp) {
  const genderStandards = ARMY_STANDARDS[gender] || ARMY_STANDARDS.male;
  const standard = genderStandards[ageGroup] || genderStandards.under_25;

  const runEval = evaluateEvent('run3k', runSec, standard);
  const pushEval = evaluateEvent('pushup', pushup, standard);
  const sitEval = evaluateEvent('situp', situp, standard);

  // 최소 등급이 전체 종합 등급
  const minLevel = Math.min(runEval.level, pushEval.level, sitEval.level);
  let overallKey = 'fail';
  for (const [key, val] of Object.entries(GRADE_ORDER)) {
    if (val.level === minLevel) {
      overallKey = key;
      break;
    }
  }
  const overall = GRADE_ORDER[overallKey];

  // 특급 기준 대비 부족한 수치(gap) 계산
  // 뜀걸음: 현재초 - 특급초 (양수면 그만큼 단축 필요)
  const runDiffToSpecial = runSec - standard.run3k.special;
  // 팔굽혀펴기: 특급개수 - 현재개수 (양수면 그만큼 추가 필요)
  const pushDiffToSpecial = standard.pushup.special - pushup;
  // 윗몸일으키기: 특급개수 - 현재개수 (양수면 그만큼 추가 필요)
  const sitDiffToSpecial = standard.situp.special - situp;

  // 바로 다음 상위 등급(Next Grade) 갭 계산
  let nextGradeKey = null;
  if (overallKey === 'fail') nextGradeKey = 'g3';
  else if (overallKey === 'g3') nextGradeKey = 'g2';
  else if (overallKey === 'g2') nextGradeKey = 'g1';
  else if (overallKey === 'g1') nextGradeKey = 'special';
  else nextGradeKey = null; // 이미 특급

  let nextTargetText = "";
  if (nextGradeKey && nextGradeKey !== 'special') {
    const nextGradeLabel = GRADE_ORDER[nextGradeKey].label;
    const nextDeficits = [];
    const nextPushDiff = standard.pushup[nextGradeKey] - pushup;
    const nextSitDiff = standard.situp[nextGradeKey] - situp;
    const nextRunDiff = runSec - standard.run3k[nextGradeKey];

    if (nextPushDiff > 0) nextDeficits.push(`팔굽혀펴기 ${nextPushDiff}개`);
    if (nextSitDiff > 0) nextDeficits.push(`윗몸일으키기 ${nextSitDiff}개`);
    if (nextRunDiff > 0) {
      const min = Math.floor(nextRunDiff / 60);
      const sec = nextRunDiff % 60;
      nextDeficits.push(`뜀걸음 ${min > 0 ? min + '분 ' + sec + '초' : sec + '초'} 단축`);
    }

    if (nextDeficits.length > 0) {
      nextTargetText = `(다음 ${nextGradeLabel} 진입까지: ${nextDeficits.join(", ")} 필요)`;
    }
  }

  let specialTargetText = "";
  const specialDeficits = [];

  if (pushDiffToSpecial > 0) specialDeficits.push(`팔굽혀펴기 ${pushDiffToSpecial}개`);
  if (sitDiffToSpecial > 0) specialDeficits.push(`윗몸일으키기 ${sitDiffToSpecial}개`);
  if (runDiffToSpecial > 0) {
    const min = Math.floor(runDiffToSpecial / 60);
    const sec = runDiffToSpecial % 60;
    const timeStr = min > 0 ? `${min}분 ${sec}초` : `${sec}초`;
    specialDeficits.push(`뜀걸음 ${timeStr} 단축`);
  }

  if (specialDeficits.length === 0) {
    specialTargetText = "모든 종목 특급 달성! 축하합니다. 당신은 자랑스러운 특급전사입니다! 🏆";
  } else {
    specialTargetText = `특급까지 ${specialDeficits.join(", ")}이(가) 필요합니다.`;
  }

  // 브리핑 전체 문구 생성 (예: "현재 2급입니다. 특급까지 팔굽혀펴기 8개, 뜀걸음 30초 단축이 필요합니다")
  const fullBriefing = `현재 ${overall.label}입니다. ${specialTargetText}`;

  // 특급 달성률(%) 계산 (각 종목 최대 100%)
  const pushProgress = Math.min(100, Math.round((pushup / standard.pushup.special) * 100));
  const sitProgress = Math.min(100, Math.round((situp / standard.situp.special) * 100));
  // 뜀걸음: 시작기준(예: 3급+1분) 대비 특급 시간까지의 역진척도
  // baseline: 3급 기준 시간 + 120초
  const baselineRun = standard.run3k.g3 + 120;
  const runProgress = Math.max(0, Math.min(100, Math.round(
    ((baselineRun - runSec) / (baselineRun - standard.run3k.special)) * 100
  )));

  const totalProgress = Math.round((pushProgress + sitProgress + runProgress) / 3);

  return {
    overall,
    briefing: fullBriefing,
    specialTargetText,
    specialDeficits,
    nextTargetText,
    standard,
    events: {
      pushup: {
        val: pushup,
        eval: pushEval,
        specialReq: standard.pushup.special,
        diffToSpecial: pushDiffToSpecial,
        progress: pushProgress
      },
      situp: {
        val: situp,
        eval: sitEval,
        specialReq: standard.situp.special,
        diffToSpecial: sitDiffToSpecial,
        progress: sitProgress
      },
      run3k: {
        val: runSec,
        eval: runEval,
        specialReq: standard.run3k.special,
        diffToSpecial: runDiffToSpecial,
        progress: runProgress
      }
    },
    totalProgress
  };
}

// 브라우저 전역 노출
window.ArmyStandards = {
  ARMY_STANDARDS,
  GRADE_ORDER,
  formatSecondsToMinSec,
  toSeconds,
  evaluateFitness,
  evaluateEvent
};
