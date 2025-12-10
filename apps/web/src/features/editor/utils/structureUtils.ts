import { PlanNodeData, PARENT_ID_ROOT } from '@/features/editor/types/node';

export interface FlatPlanNodeV2 extends PlanNodeData {
  depth: number;
  parentId: string;
}

export interface CalculatedPlanNode extends PlanNodeData {
  depth: number;
  parentId: string;

  displayStartTime: string;
  displayEndTime: string;
  displayDuration: number;

  computedStartUnix: number;
  computedEndUnix: number;

  isFixedStart: boolean;
  isFixedEnd: boolean;

  gapFromPrev: number;
  isOutOfParentRange: boolean;
  hasInternalMismatch: boolean;
}

const MIN_IN_DAY = 24 * 60;
export const toMin = (timeStr?: string): number | null => {
  if (!timeStr) return null;
  const [hStr, mStr] = timeStr.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);

  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
};

export const toStr = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  const absM = Math.abs(m);
  const mm = absM < 10 ? `0${absM}` : absM;
  return `${h}:${mm}`;
};

/**
 * 構造(Structure)とデータ(NodeMap)を結合し、
 * 時間計算を行った上でフラットリスト(CalculatedPlanNode[])を生成する
 * * @param structure 親ID -> 子IDリストのマップ
 * @param nodeMap ID -> ノードデータのマップ
 * @param defaultStartTime 計画全体の開始時刻 (デフォルト "09:00")
 */
export const buildCalculatedTree = (
  structure: Record<string, string[]>,
  nodeMap: Record<string, PlanNodeData>,
  defaultStartTime: string = "9:00"
): CalculatedPlanNode[] => {
  const result: CalculatedPlanNode[] = [];
  const visited = new Set<string>();

  const planStartMin = toMin(defaultStartTime) || 540;
  /**
   * 再帰トラバース関数
   * @param parentId 現在の親ID
   * @param currentDepth 現在の階層深さ
   * @param flowStartMin フロー上の開始時刻 (前のノードの終了時刻)
   * @param parentFixedEndMin 親の固定終了時刻 (はみ出しチェック用, nullなら制限なし)
   * @returns number このブランチ(親+子孫)の最終的な終了時刻
   */
  const traverse = (
    parentId: string,
    currentDepth: number,
    flowStartMin: number,
    parentFixedEndMin: number | null
  ): number => {
    const childrenIds = structure[parentId];
    if (!childrenIds || childrenIds.length === 0) {
      return flowStartMin;
    }

    let currentCursor = flowStartMin;

    for (const childId of childrenIds) {
      if (visited.has(childId)) {
        console.warn(`[structureUtils] Circular/Duplicate detected: ${childId}`);
        continue;
      }

      const nodeData = nodeMap[childId];
      if (!nodeData) continue;

      visited.add(childId);

      const inputS = toMin(nodeData.startTime);
      const inputE = toMin(nodeData.endTime);
      const inputD = nodeData.duration || 0;

      let calcStart = currentCursor;
      let calcEnd = currentCursor;
      let calcDur = 0;
      let mismatch = false;

      if (inputS !== null && inputE !== null) {
        calcStart = inputS;
        calcEnd = inputE;
        calcDur = calcEnd - calcStart;
        if (nodeData.duration !== undefined && inputD !== calcDur) {
          mismatch = true;
        }
      }
      else if (inputS !== null) {
        calcStart = inputS;
        calcDur = inputD;
        calcEnd = calcStart + calcDur;
      }
      else if (inputE !== null) {
        calcEnd = inputE;
        calcDur = inputD;
        calcStart = calcEnd - calcDur;
      }
      else {
        calcStart = currentCursor;
        calcDur = inputD;
        calcEnd = calcStart + calcDur;
      }

      const gap = calcStart - currentCursor;

      let isOutOf = false;
      if (parentFixedEndMin !== null){
        if (calcEnd > parentFixedEndMin) {
          isOutOf = true;
        }
      }

      const calculatedNode: CalculatedPlanNode = {
        ...nodeData,
        depth: currentDepth,
        parentId: parentId,

        // 表示用データ
        displayStartTime: toStr(calcStart),
        displayEndTime: toStr(calcEnd),
        displayDuration: calcDur,
        
        // 計算用データ
        computedStartUnix: calcStart,
        computedEndUnix: calcEnd,
        
        // フラグ
        isFixedStart: inputS !== null,
        isFixedEnd: inputE !== null,
        gapFromPrev: gap,
        isOutOfParentRange: isOutOf,
        hasInternalMismatch: mismatch,
      };

      result.push(calculatedNode);

      let nextParentLimit: number | null = null;
      if (nodeData.type === 'PROCESS' && nodeData.duration !== undefined) {
        nextParentLimit = calcEnd;
      }

      const lastChildEnd = traverse(childId, currentDepth + 1, calcStart, nextParentLimit);

      if (nodeData.type === 'PROCESS' && nodeData.duration === undefined) {
        if (childrenIds.length > 0) {
          calculatedNode.computedEndUnix = lastChildEnd;
          calculatedNode.displayEndTime = toStr(lastChildEnd);
          calculatedNode.displayDuration = lastChildEnd - calcStart;

          calcEnd = lastChildEnd;
        }
      }

      currentCursor = calcEnd;
    }

    return currentCursor;
  };

  // 実行開始
  traverse(PARENT_ID_ROOT, 0, planStartMin, null);

  return result;
};

/**
 * 構造マップとデータマップを結合し、フラットなツリーリストを生成する
 * * @param structure 親IDをキーとし、子IDのリストを値とするマップ { "root": ["A", "B"], "A": ["C"] }
 * @param nodeMap IDをキーとし、ノードの実体データとするマップ { "A": { name: "..." } }
 * @returns UI描画用のフラット配列
 */

export const buildFlatTreeV2 = (
  structure: Record<string,string[]>,
  nodeMap: Record<string, PlanNodeData>
): FlatPlanNodeV2[] =>{
  const result: FlatPlanNodeV2[] = [];

  const visited = new Set<string>();

  const traverse = (parentId: string, currentDepth: number) => {
    const childrenIds = structure[parentId];

    if (!childrenIds || childrenIds.length === 0) return;

    for (const childId of childrenIds) {
      if (visited.has(childId)) {
        console.warn(`[structureUtils] Circular reference or Duplicate detected: ${childId}`);
        continue;
      }

      const nodeData = nodeMap[childId];
      if(!nodeData) {
        continue;
      }

      visited.add(childId);

      result.push({
        ...nodeData,
        depth: currentDepth,
        parentId: parentId,
      });

      traverse(childId, currentDepth + 1);
    }
  };

  traverse(PARENT_ID_ROOT, 0);

  return result;
};