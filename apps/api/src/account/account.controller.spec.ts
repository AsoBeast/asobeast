import { Logger } from '@nestjs/common';
import type { Response } from 'express';
import type { AccountDeletionService } from './account-deletion.service';
import type { AccountExportService } from './account-export.service';
import { AccountController } from './account.controller';
import { ExportSinkClosedError, ExportStalledError } from './export-sink';

function responseWith(headersSent: boolean) {
  const res = {
    headersSent,
    setHeader: jest.fn(),
    destroy: jest.fn(),
    end: jest.fn(),
  };
  return { res, response: res as unknown as Response };
}

function controllerWith(stream: () => Promise<void>): AccountController {
  return new AccountController(
    { stream } as unknown as AccountExportService,
    {} as AccountDeletionService,
  );
}

describe('AccountController export', () => {
  afterEach(() => jest.restoreAllMocks());

  it('ends the response after a complete export', async () => {
    const { res, response } = responseWith(true);

    await controllerWith(() => Promise.resolve()).export(response);

    expect(res.end).toHaveBeenCalledTimes(1);
    expect(res.destroy).not.toHaveBeenCalled();
  });

  it('logs and destroys the socket when the export fails part way through', async () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const { res, response } = responseWith(true);

    await controllerWith(() =>
      Promise.reject(new ExportStalledError(60_000)),
    ).export(response);

    expect(error).toHaveBeenCalledWith(
      'workspace export failed part way through',
      expect.any(ExportStalledError),
    );
    expect(res.destroy).toHaveBeenCalledTimes(1);
    expect(res.end).not.toHaveBeenCalled();
  });

  it('only warns when the client closed the connection', async () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const { res, response } = responseWith(true);

    await controllerWith(() =>
      Promise.reject(new ExportSinkClosedError()),
    ).export(response);

    expect(warn).toHaveBeenCalledWith(
      'workspace export stopped: the client closed the connection',
    );
    expect(error).not.toHaveBeenCalled();
    expect(res.destroy).not.toHaveBeenCalled();
    expect(res.end).not.toHaveBeenCalled();
  });

  it('rethrows a failure before any byte was sent', async () => {
    const { response } = responseWith(false);

    await expect(
      controllerWith(() => Promise.reject(new Error('manifest failed'))).export(
        response,
      ),
    ).rejects.toThrow('manifest failed');
  });
});
