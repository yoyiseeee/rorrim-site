export type NoclippingClosingCueId =
  | 'closing-45'
  | 'closing-30'
  | 'closing-15'
  | 'closing-5'
  | 'closing-0';

export type NoclippingClosingMarker =
  | '45 min'
  | '30 min'
  | '15 min'
  | '5 min'
  | '0 min';

export type NoclippingAdAudioCue = {
  id: NoclippingClosingCueId;
  marker: NoclippingClosingMarker;
  musicSrc?: string;
  announcementSrc?: string;
  duration: number;
  playbackRate: number;
  transcript: string;
  transcriptPending?: boolean;
};

export const closingAnnouncementOrder: NoclippingClosingCueId[] = [
  'closing-45',
  'closing-30',
  'closing-15',
  'closing-5',
  'closing-0',
];

export const noclippingBackgroundMusicSrc = '/noclipping/audio/split_segments/00_start.m4a';

export const noclippingAdAudioCues: NoclippingAdAudioCue[] = [
  {
    id: 'closing-45',
    marker: '45 min',
    announcementSrc: '/noclipping/audio/announcement_clips/45min_tail_start_only.m4a',
    duration: 23.508,
    playbackRate: 1,
    // 45min text is a temporary placeholder until the full human transcript is supplied.
    transcriptPending: true,
    transcript: 'Dear customers, good evening, welcome to IKEA. IKEA will be closed in forty five minutes. Please go to checkout at first floor for your payment. If you need delivery and assembly service, please go to the delivery counter at customer service area. In addition, please take your belongings in the lockers at store entrance. IKEA wishes you have a nice day.',
  },
  {
    id: 'closing-30',
    marker: '30 min',
    announcementSrc: '/noclipping/audio/announcement_clips/30min_prompt.m4a',
    duration: 78.761333,
    playbackRate: 1,
    transcript: 'Dear customers, good evening, welcome to IKEA. IKEA will be closed in thirty minutes. Please go to checkout at first floor for your payment. If you need delivery and assembly service, please go to the delivery counter at customer service area. In addition, please take your belongings in the lockers at store entrance. IKEA wishes you have a nice day.',
  },
  {
    id: 'closing-15',
    marker: '15 min',
    announcementSrc: '/noclipping/audio/announcement_clips/15min_prompt.m4a',
    duration: 78.676,
    playbackRate: 1,
    transcript: 'Dear customers, good evening, welcome to IKEA. IKEA will be closed in fifteen minutes. Please go to checkout at first floor for your payment. If you need delivery and assembly service, please go to the delivery counter at customer service area. In addition, please take your belongings in the lockers at store entrance. Have a nice day.',
  },
  {
    id: 'closing-5',
    marker: '5 min',
    announcementSrc: '/noclipping/audio/announcement_clips/5min_prompt.m4a',
    duration: 77.545333,
    playbackRate: 1,
    transcript: 'Dear customers, good evening, welcome to IKEA. IKEA will be closed in five minutes. Please go to checkout at first floor for your payment. If you need delivery and assembly service, please go to the delivery counter at customer service area. In addition, please take your belongings in the lockers at store entrance. IKEA wishes you have a nice day.',
  },
  {
    id: 'closing-0',
    marker: '0 min',
    announcementSrc: '/noclipping/audio/announcement_clips/0min_closed_prompt.m4a',
    duration: 76.094667,
    playbackRate: 1,
    transcript: 'Good evening, IKEA visitors. IKEA has been closed. Please go to checkout at first floor for your payment. If you need delivery and assembly service, please go to the delivery counter at customer service area. In addition, please take your belongings at the store entrance. IKEA wishes you have a nice day.',
  },
];

export const getNoclippingAdAudioCue = (id: NoclippingClosingCueId) => (
  noclippingAdAudioCues.find((cue) => cue.id === id) ?? noclippingAdAudioCues[0]
);
