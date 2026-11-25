// Rewarded ads (plan 4b): the camp offers "watch an ad: x2 coins or one more try". The real SDK comes with the release (Capacitor);
// until then this stub "shows" an ad and grants the reward at once. Scenes only use `showRewardedAd`.

export interface RewardedAd {
  /** Shows an ad; resolves true when it was watched to the end (the reward is due). */
  show(): Promise<boolean>;
  /** Whether an ad can be shown now (network, SDK ready). */
  available(): boolean;
}

/** Placeholder: no network, no ad, the reward is granted after a short pause. */
export const stubRewardedAd: RewardedAd = {
  available: () => true,
  show: () => new Promise((resolve) => setTimeout(() => resolve(true), 350)),
};

let current: RewardedAd = stubRewardedAd;

/** The release replaces the stub with the SDK's implementation. */
export function setRewardedAd(ad: RewardedAd): void {
  current = ad;
}

export const rewardedAd = (): RewardedAd => current;
