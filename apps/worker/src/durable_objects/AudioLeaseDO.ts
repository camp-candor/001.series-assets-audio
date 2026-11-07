export class AudioLeaseDO {
  state: any;
  activeLeaseHolder: string | null = null;
  leaseExpiresAtMs: number = 0;
  highestCommittedVersion: number = 0;
  requestedVersionInProgress: number = 0;

  constructor(state: any) {
    this.state = state;
    this.state.blockConcurrencyWhile(async () => {
      this.activeLeaseHolder = await this.state.storage.get("activeLeaseHolder") || null;
      this.leaseExpiresAtMs = await this.state.storage.get("leaseExpiresAtMs") || 0;
      this.highestCommittedVersion = await this.state.storage.get("highestCommittedVersion") || 0;
      this.requestedVersionInProgress = await this.state.storage.get("requestedVersionInProgress") || 0;
    });
  }

  async fetch(request: Request) {
    const url = new URL(request.url);
    const body = request.method !== 'GET' ? await request.json() : {};

    if (url.pathname === '/acquire') {
      const { holderId, requestedVersion, nowMs, ttlMs = 60000 } = body;
      return Response.json(await this.acquireLease(holderId, requestedVersion, nowMs, ttlMs));
    }
    if (url.pathname === '/commit') {
      const { holderId, versionNumber, nowMs } = body;
      return Response.json(await this.commitVersion(holderId, versionNumber, nowMs || Date.now()));
    }
    if (url.pathname === '/release') {
      const { holderId } = body;
      return Response.json(await this.releaseLease(holderId));
    }
    return new Response('Not found', { status: 404 });
  }

  async acquireLease(holderId: string, requestedVersion: number, nowMs: number, ttlMs: number = 60000) {
    if (this.activeLeaseHolder && this.activeLeaseHolder !== holderId && nowMs < this.leaseExpiresAtMs) {
      return { granted: false, statusCode: 'LEASE_CONFLICT_BREACH', httpStatus: 409 };
    }
    if (requestedVersion !== this.highestCommittedVersion + 1) {
      return { granted: false, statusCode: 'MONOTONIC_REGRESSION_BREACH', httpStatus: 409, expectedVersion: this.highestCommittedVersion + 1 };
    }
    this.activeLeaseHolder = holderId;
    this.leaseExpiresAtMs = nowMs + ttlMs;
    this.requestedVersionInProgress = requestedVersion;
    await this.state.storage.put("activeLeaseHolder", this.activeLeaseHolder);
    await this.state.storage.put("leaseExpiresAtMs", this.leaseExpiresAtMs);
    await this.state.storage.put("requestedVersionInProgress", this.requestedVersionInProgress);
    return { granted: true, statusCode: 'LEASE_ACQUIRED', httpStatus: 200 };
  }

  async releaseLease(holderId: string) {
    if (this.activeLeaseHolder === holderId) {
      this.activeLeaseHolder = null;
      this.leaseExpiresAtMs = 0;
      this.requestedVersionInProgress = 0;
      await this.state.storage.delete("activeLeaseHolder");
      await this.state.storage.delete("leaseExpiresAtMs");
      await this.state.storage.delete("requestedVersionInProgress");
      return { released: true };
    }
    return { released: false };
  }

  async commitVersion(holderId: string, versionNumber: number, nowMs: number) {
    if (this.activeLeaseHolder !== holderId || nowMs >= this.leaseExpiresAtMs || versionNumber !== this.requestedVersionInProgress) {
      return { committed: false, statusCode: 'LEASE_CONFLICT_BREACH', httpStatus: 409 };
    }
    this.highestCommittedVersion = versionNumber;
    this.activeLeaseHolder = null;
    this.leaseExpiresAtMs = 0;
    this.requestedVersionInProgress = 0;
    await this.state.storage.put("highestCommittedVersion", this.highestCommittedVersion);
    await this.state.storage.delete("activeLeaseHolder");
    await this.state.storage.delete("leaseExpiresAtMs");
    await this.state.storage.delete("requestedVersionInProgress");
    return { committed: true, versionNumber };
  }
}
