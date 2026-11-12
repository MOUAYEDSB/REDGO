import type { DriverApplicationStatus, DriverMissionStatus } from "@redgo/shared";

export const deliveryStatusLabel: Record<string, string> = {
  confirmed: "Confirmée",
  searching_driver: "Recherche chauffeur",
  driver_assigned: "Chauffeur assigné",
  driver_shopping_courses: "Courses en cours",
  collecting_restaurant: "Collecte restaurant",
  on_the_way: "En route",
  delivered: "Livrée",
  cash_collected: "Espèces encaissées",
  cancelled: "Annulée",
};

export const rideStatusLabel: Record<string, string> = {
  searching: "Recherche",
  driver_assigned: "Chauffeur assigné",
  approaching_pickup: "Approche prise en charge",
  arrived_at_pickup: "Arrivé au point",
  ride_started: "Course en cours",
  ride_completed: "Terminée",
  cancelled: "Annulée",
};

export const missionStatusLabel: Record<DriverMissionStatus, string> = {
  searching: "En recherche",
  assigned: "Assignée",
  accepted: "Acceptée",
  in_progress: "En cours",
  completed: "Terminée",
  cancelled: "Annulée",
};

export const driverStatusLabel: Record<DriverApplicationStatus, string> = {
  pending: "En attente",
  approved: "Approuvé",
  rejected: "Refusé",
  suspended: "Suspendu",
};

export const paymentStatusLabel = {
  pending: "En attente",
  paid: "Payé",
  cancelled: "Annulé",
} as const;

export const OPEN_DELIVERY_STATUSES = [
  "confirmed",
  "searching_driver",
  "driver_assigned",
  "driver_shopping_courses",
  "collecting_restaurant",
  "on_the_way",
];

export const DONE_DELIVERY_STATUSES = ["delivered", "cash_collected"];
