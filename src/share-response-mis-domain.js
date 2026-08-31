export const SHARE_RESPONSE_MIS_POLICY_VERSION = 'r3c-share-response-mis-v1';

const EVENT_TYPES = new Set([
  'shared',
  'delivered',
  'opened',
  'responded',
  'viewing_requested',
  'converted'
]);

const RESPONSE_TYPES = new Set([
  'interested',
  'viewing_requested',
  'information_required',
  'more_options',
  'not_suitable'
]);

function requireText(value, label) {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new Error(`${label} is required`);
  return normalized;
}

function requireInstant(value, label) {
  const normalized = requireText(value, label);
  if (!Number.isFinite(Date.parse(normalized))) throw new Error(`${label} must be an ISO timestamp`);
  return normalized;
}

function unique(values) {
  return [...new Set(values)];
}

function hoursBetween(from, to) {
  return Math.max(0, Math.floor((Date.parse(to) - Date.parse(from)) / 3_600_000));
}

export function buildShareResponseMis({ packages = [], events = [], tasks = [], now }) {
  const evaluatedAt = requireInstant(now, 'now');
  const normalizedPackages = packages.map(item => ({
    packageRef: requireText(item.packageRef, 'packageRef'),
    opportunityRef: requireText(item.opportunityRef, 'opportunityRef'),
    brokerRef: requireText(item.brokerRef, 'brokerRef'),
    preparedAt: requireInstant(item.preparedAt, 'preparedAt'),
    status: requireText(item.status, 'status'),
    propertyRefs: unique((item.propertyRefs ?? []).map(value => requireText(value, 'propertyRef')))
  }));

  if (new Set(normalizedPackages.map(item => item.packageRef)).size !== normalizedPackages.length) {
    throw new Error('packageRef must be unique');
  }
  for (const item of normalizedPackages) {
    if (item.status !== 'prepared_not_sent') throw new Error('only prepared_not_sent packages are accepted');
    if (item.propertyRefs.length === 0) throw new Error('each package requires at least one propertyRef');
  }

  const packageByRef = new Map(normalizedPackages.map(item => [item.packageRef, item]));
  const normalizedEvents = events.map(item => {
    const type = requireText(item.type, 'event type');
    if (!EVENT_TYPES.has(type)) throw new Error(`unsupported event type: ${type}`);
    const packageRef = requireText(item.packageRef, 'event packageRef');
    const propertyRef = item.propertyRef ? requireText(item.propertyRef, 'event propertyRef') : null;
    const responseType = item.responseType ? requireText(item.responseType, 'responseType') : null;
    const event = {
      packageRef,
      type,
      occurredAt: requireInstant(item.occurredAt, 'occurredAt'),
      evidenceRef: requireText(item.evidenceRef, 'evidenceRef'),
      propertyRef,
      responseType
    };
    const parent = packageByRef.get(packageRef);
    if (!parent) throw new Error(`event references unknown package: ${packageRef}`);
    if (Date.parse(event.occurredAt) < Date.parse(parent.preparedAt)) throw new Error('event predates package preparation');
    if (propertyRef && !parent.propertyRefs.includes(propertyRef)) throw new Error('event property is not in the package');
    if (type === 'responded') {
      if (!propertyRef || !responseType || !RESPONSE_TYPES.has(responseType)) {
        throw new Error('responded events require a packaged property and supported responseType');
      }
    } else if (responseType) {
      throw new Error('responseType is only valid for responded events');
    }
    return event;
  });

  if (new Set(normalizedEvents.map(item => item.evidenceRef)).size !== normalizedEvents.length) {
    throw new Error('event evidenceRef must be unique');
  }

  const taskByEvidence = new Map();
  for (const task of tasks) {
    const sourceEvidenceRef = requireText(task.sourceEvidenceRef, 'task sourceEvidenceRef');
    if (taskByEvidence.has(sourceEvidenceRef)) throw new Error('one response cannot govern multiple Tasks');
    taskByEvidence.set(sourceEvidenceRef, {
      taskRef: requireText(task.taskRef, 'taskRef'),
      sourceEvidenceRef,
      subject: requireText(task.subject, 'task subject'),
      status: requireText(task.status, 'task status'),
      dueAt: requireInstant(task.dueAt, 'task dueAt')
    });
  }

  const exactPackageCount = type => new Set(
    normalizedEvents.filter(event => event.type === type).map(event => event.packageRef)
  ).size;
  const responses = normalizedEvents.filter(event => event.type === 'responded');
  const propertyResponses = responses.map(response => {
    const task = taskByEvidence.get(response.evidenceRef) ?? null;
    let followUpState = 'missing_authoritative_task';
    if (task) {
      if (task.status === 'completed') followUpState = 'completed';
      else if (Date.parse(task.dueAt) < Date.parse(evaluatedAt)) followUpState = 'overdue';
      else followUpState = 'open';
    }
    return {
      ...response,
      task,
      followUpState,
      responseAgeHours: hoursBetween(response.occurredAt, evaluatedAt)
    };
  });

  const rows = normalizedPackages.map(item => {
    const packageEvents = normalizedEvents
      .filter(event => event.packageRef === item.packageRef)
      .sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));
    const latestAt = packageEvents.at(-1)?.occurredAt ?? item.preparedAt;
    const exactStates = Object.fromEntries([...EVENT_TYPES].map(type => [type, packageEvents.some(event => event.type === type)]));
    return {
      ...item,
      exactStates,
      lifecycleState: packageEvents.length === 0 ? 'prepared_not_sent' : packageEvents.at(-1).type,
      latestAt,
      ageHours: hoursBetween(latestAt, evaluatedAt),
      propertyResponses: propertyResponses.filter(response => response.packageRef === item.packageRef)
    };
  });

  return {
    policyVersion: SHARE_RESPONSE_MIS_POLICY_VERSION,
    classification: 'synthetic_local_not_integrated',
    evaluatedAt,
    metrics: {
      prepared: normalizedPackages.length,
      shared: exactPackageCount('shared'),
      delivered: exactPackageCount('delivered'),
      opened: exactPackageCount('opened'),
      responded: exactPackageCount('responded'),
      viewingRequested: exactPackageCount('viewing_requested'),
      converted: exactPackageCount('converted'),
      missingFollowUp: propertyResponses.filter(item => item.followUpState === 'missing_authoritative_task').length,
      overdueFollowUp: propertyResponses.filter(item => item.followUpState === 'overdue').length
    },
    rows
  };
}
