export type RegistrationLink = {
    token: string;
    closedAt: string | null;
    expiresAt: string | null;
  };
  
  export type ClinicSeries = {
    id: string;
    name: string;
    programType: string;
    level: string | null;
    startDate: string;
    endDate: string;
    registrationOpen: boolean;
    registrationLink: RegistrationLink | null;
    _count: {
      sessions: number;
      registrations: number;
    };
  };
  
  export type SeriesDraft = {
    name: string;
    programType: string;
    level: string;
    startDate: string;
    endDate: string;
    registrationOpen: boolean;
  };