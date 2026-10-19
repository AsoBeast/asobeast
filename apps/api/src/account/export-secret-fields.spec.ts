import { Prisma } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { exportTables, withoutSecrets } from './export-tables';

const CREDENTIAL_SHAPED = /hash|secret|password|token|session/i;

const REVIEWED_NOT_SECRET = [
  'AuditInsight.inputHash',
  'AiCall.inputTokens',
  'AiCall.cachedInputTokens',
  'AiCall.outputTokens',
];

const exportedModels = exportTables({} as PrismaService).map(
  ({ name }) => name.charAt(0).toUpperCase() + name.slice(1),
);

const credentialShaped = Prisma.dmmf.datamodel.models
  .filter(({ name }) => exportedModels.includes(name))
  .flatMap(({ name, fields }) =>
    fields
      .filter(
        (field) =>
          field.kind === 'scalar' && CREDENTIAL_SHAPED.test(field.name),
      )
      .map((field) => `${name}.${field.name}`),
  );

const fieldOf = (column: string): string => column.split('.')[1];

describe('the credential shaped columns of the exported models', () => {
  it('are found in the model description', () => {
    expect(credentialShaped).toEqual(
      expect.arrayContaining(['User.passwordHash', 'User.resetHash']),
    );
  });

  it.each(credentialShaped.filter((c) => !REVIEWED_NOT_SECRET.includes(c)))(
    'leaves %s out of the export',
    (column) => {
      expect(withoutSecrets({ [fieldOf(column)]: 'value' })).toEqual({});
    },
  );

  it.each(REVIEWED_NOT_SECRET)(
    'keeps %s, which only looks like a credential',
    (column) => {
      expect(withoutSecrets({ [fieldOf(column)]: 1 })).toEqual({
        [fieldOf(column)]: 1,
      });
    },
  );
});
