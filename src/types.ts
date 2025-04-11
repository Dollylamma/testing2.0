export interface RawSignUpData {
    [key: string]: string;
    'Item': string;
    'First Name': string;
    'Last Name': string;
    'Email': string;
    'Start Date/Time': string;
    'End Date/Time': string;
  }
  
  export interface StructuredSignUpData {
    id: number;
    position_ID: string;
    volunteer_name: string;
    volunteer_email: string;
    start_date: string;
    start_datetime: string;
    end_datetime: string;
    arrived: string;
  }