/** `habit.update` — o catálogo do pedido original não lista `habit.create` nesta fase; ver `goals.types.ts` para o mesmo raciocínio aplicado a metas. */
export interface UpdateHabitInput {
  id: string;
  completedToday?: boolean;
  streakDays?: number;
}
