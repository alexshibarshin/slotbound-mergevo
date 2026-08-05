import { HEROES } from '../config/gameConfig';
import type { HeroState } from '../types/game';
import { calculateHeroStats } from './statsCore';

export const getHeroStats = (hero: HeroState) => calculateHeroStats(hero, HEROES[hero.id]);
