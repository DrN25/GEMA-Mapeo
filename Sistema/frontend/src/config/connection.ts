export interface ConnectionModalTexts {
  title: string;
  description: string;
  retryingStatus: string;
  retryingButtonText: string;
  retryButtonText: string;
  reloadButtonText: string;
  reloadConfirmText: string;
}

export interface ConnectionConfig {
  activeIntervalMs: number;
  hiddenIntervalMs: number;
  keepAwakeMs: number;
  stopPingsAfterKeepAwake: boolean;
  pingTimeoutMs: number;
  confirmTimeoutMs: number;
  confirmMaxAttempts: number;
  confirmRetryDelayMs: number;
  reconnectIntervalMs: number;
  modal: ConnectionModalTexts;
}

const DEFAULT_CONNECTION_CONFIG: ConnectionConfig = {
  activeIntervalMs: 20_000,
  hiddenIntervalMs: 480_000,
  keepAwakeMs: 2_700_000,
  stopPingsAfterKeepAwake: true,
  pingTimeoutMs: 6_000,
  confirmTimeoutMs: 8_000,
  confirmMaxAttempts: 1,
  confirmRetryDelayMs: 300,
  reconnectIntervalMs: 4_000,
  modal: {
    title: 'Conexión con el servidor perdida',
    description:
      'El servidor no responde, reintentando… Se perdió la comunicación temporalmente. Tus datos locales se conservan en esta sesión; esta ventana se cerrará automáticamente cuando vuelva la conexión.',
    retryingStatus: 'El servidor no responde, reintentando…',
    retryingButtonText: 'Reintentando…',
    retryButtonText: 'Reintentar conexión',
    reloadButtonText: 'Recargar página',
    reloadConfirmText: '¿Recargar la página ahora?',
  },
};

type ConnectionConfigOverride = Partial<Omit<ConnectionConfig, 'modal'>> & {
  modal?: Partial<ConnectionModalTexts>;
};

function buildConnectionConfig(): ConnectionConfig {
  const runtimeOverride: ConnectionConfigOverride | undefined =
    typeof globalThis !== 'undefined'
      ? (globalThis as { __GEMA_CONNECTION_CONFIG__?: ConnectionConfigOverride }).__GEMA_CONNECTION_CONFIG__
      : undefined;

  if (!runtimeOverride) return DEFAULT_CONNECTION_CONFIG;

  return {
    ...DEFAULT_CONNECTION_CONFIG,
    ...runtimeOverride,
    modal: {
      ...DEFAULT_CONNECTION_CONFIG.modal,
      ...(runtimeOverride.modal ?? {}),
    },
  };
}

export const CONNECTION_CONFIG: ConnectionConfig = buildConnectionConfig();

