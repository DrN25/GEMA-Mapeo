export interface User {
  usuario_id: number;
  usuario: str;
  email: string;
  nombre_completo?: string | null;
  rol_id: number;
  rol_nombre: string;
  geotecnico_id?: number | null;
  estado: string; // 'A' | 'I' | '*'
  ultimo_acceso?: string | null;
  fecha_registro: string;
}

export type str = string;

export interface Role {
  rol_id: number;
  nombre: string;
  descripcion?: string | null;
  estado: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface LoginCredentials {
  username_or_email: string;
  password: string;
}

export interface UserCreatePayload {
  usuario: string;
  email: string;
  password: string;
  nombre_completo?: string;
  rol_id: number;
  geotecnico_id?: number | null;
}

export interface UserUpdatePayload {
  nombre_completo?: string;
  email?: string;
  rol_id?: number;
  geotecnico_id?: number | null;
  password?: string;
}
