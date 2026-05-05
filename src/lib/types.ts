export type CompanyType = 'startup' | 'pme' | 'grand-groupe' | 'public' | 'cabinet';
export type JobFamily =
  | 'marketing'
  | 'finance'
  | 'rh'
  | 'commerce'
  | 'tech'
  | 'communication'
  | 'logistique'
  | 'juridique'
  | 'conseil';

export type ApplicationStatus =
  | 'interested'
  | 'applied'
  | 'interview'
  | 'offer'
  | 'rejected';

export interface ApprenticeshipOffer {
  id: string;
  title: string;
  company: string;
  companyType: CompanyType;
  jobFamily: JobFamily;
  location: string;
  duration: string;
  startDate: string;
  salary: number;
  credibility: 1 | 2 | 3 | 4 | 5;
  description: string;
  requirements: string[];
  postedDate: string;
  companyDescription: string;
  companyWebsite?: string;
  tags: string[];
  logo?: string;
}

export interface Application {
  offerId: string;
  status: ApplicationStatus;
  appliedDate?: string;
  notes?: string;
  coverLetterSent?: boolean;
  updatedAt: string;
}

export interface Alumni {
  id: string;
  name: string;
  role: string;
  company: string;
  graduationYear: number;
  linkedinUrl?: string;
  program: string;
  avatarInitials: string;
}

export interface CompanyNews {
  id: string;
  company: string;
  title: string;
  summary: string;
  date: string;
  source: string;
  url?: string;
  type: 'recruitment' | 'finance' | 'innovation' | 'rse' | 'general';
}

export interface UserProfile {
  firstName: string;
  lastName: string;
  school: string;
  program: string;
  graduationYear: number;
  email: string;
  phone?: string;
  linkedinUrl?: string;
  skills: string[];
}
