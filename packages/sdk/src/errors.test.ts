import {
  ContractCallError,
  InvalidAddressError,
  XDRParseError,
  NetworkError,
} from './errors';

describe('ContractCallError', () => {
  it('creates an error with name, message, contractId, and method', () => {
    const err = new ContractCallError('Simulation failed', 'CA3D...', 'get_reputation');
    expect(err.name).toBe('ContractCallError');
    expect(err.message).toBe('Simulation failed');
    expect(err.contractId).toBe('CA3D...');
    expect(err.method).toBe('get_reputation');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ContractCallError);
  });

  it('works without optional params', () => {
    const err = new ContractCallError('Failed');
    expect(err.contractId).toBeUndefined();
    expect(err.method).toBeUndefined();
  });
});

describe('InvalidAddressError', () => {
  it('creates an error with name, message, and address', () => {
    const err = new InvalidAddressError('Bad address format', 'GINVALID...');
    expect(err.name).toBe('InvalidAddressError');
    expect(err.message).toBe('Bad address format');
    expect(err.address).toBe('GINVALID...');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(InvalidAddressError);
  });

  it('works without optional address', () => {
    const err = new InvalidAddressError('Missing address');
    expect(err.address).toBeUndefined();
  });
});

describe('XDRParseError', () => {
  it('creates an error with name and message', () => {
    const err = new XDRParseError('Invalid XDR encoding');
    expect(err.name).toBe('XDRParseError');
    expect(err.message).toBe('Invalid XDR encoding');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(XDRParseError);
  });
});

describe('NetworkError', () => {
  it('creates an error with name, message, and statusCode', () => {
    const err = new NetworkError('Request timed out', 504);
    expect(err.name).toBe('NetworkError');
    expect(err.message).toBe('Request timed out');
    expect(err.statusCode).toBe(504);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(NetworkError);
  });

  it('works without optional statusCode', () => {
    const err = new NetworkError('Network unavailable');
    expect(err.statusCode).toBeUndefined();
  });
});
