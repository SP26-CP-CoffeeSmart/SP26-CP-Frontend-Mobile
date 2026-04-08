const normalizeText = (value: unknown) => String(value ?? '').trim().toLowerCase();

const parseDate = (value: unknown) => {
  if (value === null || value === undefined) {
    return 0;
  }

  const timestamp = new Date(String(value)).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const toNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
};

const isActiveSubscription = (item: any) => {
  const status = normalizeText(item?.status ?? item?.subscriptionStatus ?? item?.state);

  if (typeof item?.isActive === 'boolean') {
    return item.isActive;
  }

  if (typeof item?.active === 'boolean') {
    return item.active;
  }

  return status === 'active' || status === 'trialing' || status === 'paid' || status === 'current';
};

const getSubscriptionEndTimestamp = (item: any) =>
  parseDate(
    item?.endDate ??
      item?.expiredAt ??
      item?.expireDate ??
      item?.expiresAt ??
      item?.validTo
  );

const getSubscriptionUpdateTimestamp = (item: any) =>
  parseDate(
    item?.updatedAt ??
      item?.modifiedAt ??
      item?.createdAt ??
      item?.startDate ??
      item?.subscribedAt
  );

const getSubscriptionId = (item: any) =>
  toNumber(item?.subscriptionId ?? item?.id ?? item?.packageId ?? item?.subscriptionPackageId);

export const extractSubscriptionCandidates = (payload: any): any[] => {
  if (!payload) {
    return [];
  }

  if (Array.isArray(payload)) {
    return payload.filter(Boolean);
  }

  const list = payload?.items ?? payload?.results ?? payload?.subscriptions;
  if (Array.isArray(list)) {
    return list.filter(Boolean);
  }

  const data = payload?.data;
  if (Array.isArray(data)) {
    return data.filter(Boolean);
  }

  const nestedItems = payload?.data?.items;
  if (Array.isArray(nestedItems)) {
    return nestedItems.filter(Boolean);
  }

  const single = payload?.data ?? payload?.item ?? payload?.result ?? payload;
  return single ? [single] : [];
};

export const resolveCurrentSubscription = (payload: any) => {
  const candidates = extractSubscriptionCandidates(payload);
  if (candidates.length === 0) {
    return null;
  }

  const sorted = [...candidates].sort((a, b) => {
    const activeDiff = Number(isActiveSubscription(b)) - Number(isActiveSubscription(a));
    if (activeDiff !== 0) {
      return activeDiff;
    }

    const endDiff = getSubscriptionEndTimestamp(b) - getSubscriptionEndTimestamp(a);
    if (endDiff !== 0) {
      return endDiff;
    }

    const updateDiff = getSubscriptionUpdateTimestamp(b) - getSubscriptionUpdateTimestamp(a);
    if (updateDiff !== 0) {
      return updateDiff;
    }

    return getSubscriptionId(b) - getSubscriptionId(a);
  });

  return sorted[0] ?? null;
};
