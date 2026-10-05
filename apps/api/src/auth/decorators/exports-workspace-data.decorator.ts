import { SetMetadata } from '@nestjs/common';

export const EXPORTS_WORKSPACE_DATA_KEY = 'auth:exportsWorkspaceData';

export const ExportsWorkspaceData = () =>
  SetMetadata(EXPORTS_WORKSPACE_DATA_KEY, true);
