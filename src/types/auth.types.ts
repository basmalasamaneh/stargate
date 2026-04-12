export interface SignupInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface BecomeArtistInput {
  artistName: string;
  bio: string;
  location: string;
  phone: string;
  socialMedia?: string;
}
  