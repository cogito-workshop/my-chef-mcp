declare global {
  interface Recipe {
    id: string;
    name: string;
    description: string;
    source_path: string;
    image_path: string | null;
    category: string;
    difficulty: number;
    tags: string[];
    servings: number;
    ingredients: Ingredient[];
    steps: Step[];
    prep_time_minutes: number | null;
    cook_time_minutes: number | null;
    total_time_minutes: number | null;
    additional_notes: string[];
  }

  // define ingredient
  interface Ingredient {
    name: string;
    quantity: number | null;
    unit: string | null;
    text_quantity: string;
    notes: string;
  }

  interface Step {
    step: number;
    description: string;
  }

  // simplify Recipe
  interface SimpleRecipe {
    id: string;
    name: string;
    description: string;
    ingredients: {
      name: string;
      text_quantity: string;
    }[];
  }

  // more simple Recipe, only include `name` and `description` which is used for `getAllRecipes` method
  interface NameOnlyRecipe {
    name: string;
    description: string;
  }

  // define meal plan
  interface MealPlan {
    weekdays: Array<DayPlan>;
    weekend: Array<DayPlan>;
    groceryList: GroceryList;
  }

  interface DayPlan {
    day: string;
    breakfast: SimpleRecipe[];
    lunch: SimpleRecipe[];
    dinner: SimpleRecipe[];
  }

  interface GroceryList {
    ingredients: Array<{
      name: string;
      totalQuantity: number | null;
      unit: string | null;
      recipeCount: number;
      recipes: string[];
    }>;
    shoppingPlan: {
      fresh: string[];
      pantry: string[];
      spices: string[];
      others: string[];
    };
  }

  // define the recommended dishes
  interface DishRecommendation {
    peopleCount: number;
    meatDishCount: number;
    vegetableDishCount: number;
    dishes: SimpleRecipe[];
    message: string;
  }
}

export {};
