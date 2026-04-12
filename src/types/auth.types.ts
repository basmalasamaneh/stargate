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

export enum SocialMediaPlatform {
  INSTAGRAM = "instagram",
  FACEBOOK = "facebook",
  LINKEDIN = "linkedin",
  PINTEREST = "pinterest",
  X = "x",
}

export interface SocialMediaLink {
  platform: SocialMediaPlatform;
  url: string;
}

export interface BecomeArtistInput {
  artistName: string;
  bio: string;
  location: string;
  phone: string;
  socialMedia?: SocialMediaLink[];
}
  