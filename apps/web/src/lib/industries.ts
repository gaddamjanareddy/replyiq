/**
 * Common answers to "what do you do".
 *
 * Not a taxonomy and not validated against — the field accepts anything typed.
 * These exist to show the SHAPE of a good answer: a short label rather than a
 * description, which is the actual problem with the field. Someone reading
 * "Dental practice" and "Plumbing" understands in a glance that a paragraph
 * about their business belongs in the box below.
 *
 * Weighted towards the small service businesses this product is for, and
 * ordered roughly by how likely they are rather than alphabetically, because
 * a list you scan should put the probable answers first.
 */
export const INDUSTRY_SUGGESTIONS = [
  'Dental practice',
  'Medical practice',
  'Veterinary clinic',
  'Hair salon',
  'Beauty salon',
  'Barber shop',
  'Restaurant',
  'Café',
  'Bakery',
  'Pub or bar',
  'Hotel or B&B',
  'Plumbing',
  'Electrician',
  'Heating engineer',
  'Builder',
  'Roofing',
  'Landscaping',
  'Cleaning services',
  'Removals',
  'Car garage',
  'Estate agent',
  'Letting agent',
  'Solicitor',
  'Accountant',
  'Financial adviser',
  'Insurance broker',
  'Recruitment agency',
  'Marketing agency',
  'Design agency',
  'Software company',
  'IT support',
  'Photography',
  'Fitness studio',
  'Yoga studio',
  'Physiotherapy',
  'Chiropractor',
  'Optician',
  'Pharmacy',
  'Childcare or nursery',
  'Tutoring',
  'Driving school',
  'Charity',
  'Retail shop',
] as const;
