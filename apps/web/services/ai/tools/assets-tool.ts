import type { NovaActionResult, NovaContext } from '@/services/nova';
import { CreateAssetAction, type CreateAssetInput } from '../actions';

/** Ferramenta de Patrimônio. Hoje só chama a Action correspondente. */
export class AssetsTool {
  registerAsset(ctx: NovaContext, input: CreateAssetInput): NovaActionResult[] {
    return new CreateAssetAction(input).execute(ctx);
  }
}
