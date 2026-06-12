export type NoclippingAdCopy = {
  id: string;
  marker: string;
  zh: string;
  en: string;
};

export type NoclippingAdFlashCopy = {
  zh: string;
  en: string;
};

export const noclippingAdCopy: NoclippingAdCopy[] = [
  {
    id: "closing-45-a",
    marker: "45 minutes",
    zh: "为了您的舒适体验，坠落已被暂时暂停。",
    en: "Your descent has been paused for your comfort.",
  },
  {
    id: "closing-45-b",
    marker: "45 minutes",
    zh: "出口正在重新计算。请继续观看当前房间。",
    en: "The exit is being recalculated. Please continue viewing the current room.",
  },
  {
    id: "closing-30-a",
    marker: "30 minutes",
    zh: "图册仍在为您准备一个可以停留的房间。",
    en: "The catalogue is still preparing a room for you.",
  },
  {
    id: "closing-30-b",
    marker: "30 minutes",
    zh: "请不要离开。您的观看将帮助空间完成复制。",
    en: "Please do not leave. Your attention will help the room complete its copy.",
  },
  {
    id: "closing-15-a",
    marker: "15 minutes",
    zh: "您尚未离开本层空间。",
    en: "You have not left this floor.",
  },
  {
    id: "closing-15-b",
    marker: "15 minutes",
    zh: "镜面将在广告结束后继续开放。",
    en: "The mirror will remain available after the advertisement.",
  },
  {
    id: "closing-5-a",
    marker: "5 minutes",
    zh: "您的注意力是继续下坠所需的通行凭证。",
    en: "Your attention is the receipt required to continue falling.",
  },
  {
    id: "closing-5-b",
    marker: "5 minutes",
    zh: "请保持眼睛可用。系统即将恢复坠落。",
    en: "Please keep your eyes available. Falling will resume shortly.",
  },
  {
    id: "closing-0-a",
    marker: "0 minutes",
    zh: "本店已经关闭。",
    en: "The store is now closed.",
  },
  {
    id: "closing-0-b",
    marker: "0 minutes",
    zh: "镜子仍在营业。",
    en: "The mirror remains open.",
  },
];

export const noclippingAdFlashCopy: NoclippingAdFlashCopy[] = [
  { zh: "请继续留在房间内。", en: "Please remain inside the room." },
  { zh: "出口正在重新计算。", en: "The exit is being recalculated." },
  { zh: "图册尚未与您完成。", en: "The catalogue has not finished with you." },
  { zh: "您的舒适体验正在加载。", en: "Your comfort experience is loading." },
  { zh: "坠落将在广告后恢复。", en: "Falling will resume after the advertisement." },
  { zh: "请保持眼睛可用。", en: "Please keep your eyes available." },
  { zh: "墙面不是故障。", en: "The wall is not an error." },
  { zh: "房间正在复制。", en: "The room is being duplicated." },
  { zh: "您的等待正在改善空间。", en: "Your waiting is improving the space." },
  { zh: "镜子不接受退场。", en: "The mirror does not accept departure." },
  { zh: "感谢您的被动配合。", en: "Thank you for your passive cooperation." },
  { zh: "请确认您仍然疲惫。", en: "Please confirm that you are still tired." },
];
