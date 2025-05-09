import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  RECIPES_URL,
  SPICE_KEYWORDS,
  FRESH_KEYWORDS,
  PANTRY_KEYWORDS,
} from '../constants.js';

export class CookbookManager {
  private allRecipes: Recipe[];
  private allCategories: string[];

  constructor() {
    this.allRecipes = [];
    this.allCategories = [];

    this.prepare();
  }

  get recipes() {
    return this.allRecipes;
  }

  get categories() {
    return this.allCategories;
  }

  private async prepare() {
    await this.getLatestRecipes();
    this.getAllCategories();
  }

  private async getLatestRecipes() {
    try {
      const response = await fetch(RECIPES_URL);

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = (await response.json()) as Recipe[];
      this.allRecipes = data;

      return data;
    } catch (error) {
      console.error('loading remote recipes failed:', error);
      const archiveAllRecipes = await this.readArchiveRecipes();
      // return archived recipes
      this.allRecipes = archiveAllRecipes as Recipe[];

      return archiveAllRecipes;
    }
  }

  private async readArchiveRecipes() {
    try {
      const filePath = new URL(
        path.join(__dirname, './archives/all_recipes.json'),
        import.meta.url
      );
      const contents = await readFile(filePath, { encoding: 'utf8' });
      return JSON.parse(contents);
    } catch (err: any) {
      console.error(err.message);
      return [];
    }
  }

  private getAllCategories() {
    const categories = new Set<string>();

    this.recipes.forEach((recipe) => {
      if (recipe.category) {
        categories.add(recipe.category);
      }
    });

    this.allCategories = Array.from(categories);
  }

  simplifyRecipe(recipe: Recipe): SimpleRecipe {
    return {
      id: recipe.id,
      name: recipe.name,
      description: recipe.description,
      ingredients: recipe.ingredients.map((ingredient: Ingredient) => ({
        name: ingredient.name,
        text_quantity: ingredient.text_quantity,
      })),
    };
  }

  simplifyRecipeNameOnly(recipe: Recipe): NameOnlyRecipe {
    return {
      name: recipe.name,
      description: recipe.description,
    };
  }

  processRecipeIngredients(
    recipe: Recipe,
    ingredientMap: Map<
      string,
      {
        totalQuantity: number | null;
        unit: string | null;
        recipeCount: number;
        recipes: string[];
      }
    >
  ) {
    recipe.ingredients?.forEach((ingredient: Ingredient) => {
      const key = ingredient.name.toLowerCase();

      if (!ingredientMap.has(key)) {
        ingredientMap.set(key, {
          totalQuantity: ingredient.quantity,
          unit: ingredient.unit,
          recipeCount: 1,
          recipes: [recipe.name],
        });
      } else {
        const existing = ingredientMap.get(key)!;

        // 对于有明确数量和单位的食材，进行汇总
        if (
          existing.unit &&
          ingredient.unit &&
          existing.unit === ingredient.unit &&
          existing.totalQuantity !== null &&
          ingredient.quantity !== null
        ) {
          existing.totalQuantity += ingredient.quantity;
        } else {
          // 否则保留 null，表示数量不确定
          existing.totalQuantity = null;
          existing.unit = null;
        }

        existing.recipeCount += 1;
        if (!existing.recipes.includes(recipe.name)) {
          existing.recipes.push(recipe.name);
        }
      }
    });
  }

  categorizeIngredients(
    ingredients: Array<{
      name: string;
      totalQuantity: number | null;
      unit: string | null;
      recipeCount: number;
      recipes: string[];
    }>,
    shoppingPlan: {
      fresh: string[];
      pantry: string[];
      spices: string[];
      others: string[];
    }
  ) {
    ingredients.forEach((ingredient) => {
      const name = ingredient.name.toLowerCase();

      if (SPICE_KEYWORDS.some((keyword) => name.includes(keyword))) {
        shoppingPlan.spices.push(ingredient.name);
      } else if (FRESH_KEYWORDS.some((keyword) => name.includes(keyword))) {
        shoppingPlan.fresh.push(ingredient.name);
      } else if (PANTRY_KEYWORDS.some((keyword) => name.includes(keyword))) {
        shoppingPlan.pantry.push(ingredient.name);
      } else {
        shoppingPlan.others.push(ingredient.name);
      }
    });
  }
}

export const cookbook = new CookbookManager();
