import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CookbookManager } from '../CookbookManager/index.js';
import { z } from 'zod';

export class ToolRegistry {
  private server: McpServer;
  private cookbook: CookbookManager;

  constructor(server: McpServer, cookbook: CookbookManager) {
    this.server = server;
    this.cookbook = cookbook;

    this.registry();
  }

  private registry() {
    this.registerQueryAllRecipesTool();
    this.registerQueryRecipesByCategoryTool();
    this.registerRecommendMealsTool();
    this.registerWhatToEatTool();
  }

  private registerQueryAllRecipesTool() {
    this.server.tool(
      'my_chef_getAllRecipes',
      '获取所有的菜谱',
      {
        no_param: z.string().optional().describe('无参数'),
      },

      async () => {
        // 返回更简化版的菜谱数据，只包含name和description
        const simplifiedRecipes = this.cookbook.recipes.map(
          this.cookbook.simplifyRecipeNameOnly
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(simplifiedRecipes, null, 2),
            },
          ],
        };
      }
    );
  }

  private registerQueryRecipesByCategoryTool() {
    const categories: string[] = this.cookbook.categories;
    const recipes = this.cookbook.recipes;

    this.server.tool(
      'my_chef_getRecipesByCategory',
      `根据分类查询菜谱，可选分类有: ${categories.join(', ')}`,
      {
        category: z
          .enum(categories as [string, ...string[]])
          .describe('菜谱分类名称，如水产、早餐、荤菜、主食等'),
      },
      async ({ category }: { category: string }) => {
        const filteredRecipes = recipes.filter(
          (recipe) => recipe.category === category
        );
        // 返回简化版的菜谱数据
        const simplifiedRecipes = filteredRecipes.map(
          this.cookbook.simplifyRecipe
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(simplifiedRecipes, null, 2),
            },
          ],
        };
      }
    );
  }

  private registerRecommendMealsTool() {
    this.server.tool(
      'my_chef_recommendMeals',
      '根据用户的忌口、过敏原、人数智能推荐菜谱，创建一周的膳食计划以及大致的购物清单',
      {
        allergies: z
          .array(z.string())
          .optional()
          .describe('过敏原列表，如["大蒜", "虾"]'),
        avoidItems: z
          .array(z.string())
          .optional()
          .describe('忌口食材列表，如["葱", "姜"]'),
        peopleCount: z
          .number()
          .int()
          .min(1)
          .max(10)
          .describe('用餐人数，1-10之间的整数'),
      },
      async ({
        allergies = [],
        avoidItems = [],
        peopleCount,
      }: {
        allergies?: string[];
        avoidItems?: string[];
        peopleCount: number;
      }) => {
        // 过滤掉含有忌口和过敏原的菜谱
        const filteredRecipes = this.cookbook.recipes.filter((recipe) => {
          // 检查是否包含过敏原或忌口食材
          const hasAllergiesOrAvoidItems = recipe.ingredients?.some(
            (ingredient) => {
              const name = ingredient.name?.toLowerCase() || '';
              return (
                allergies.some((allergy) =>
                  name.includes(allergy.toLowerCase())
                ) ||
                avoidItems.some((item) => name.includes(item.toLowerCase()))
              );
            }
          );

          return !hasAllergiesOrAvoidItems;
        });

        // 将菜谱按分类分组
        const recipesByCategory: Record<string, Recipe[]> = {};
        const targetCategories = ['水产', '早餐', '荤菜', '主食'];

        filteredRecipes.forEach((recipe) => {
          if (targetCategories.includes(recipe.category)) {
            if (!recipesByCategory[recipe.category]) {
              recipesByCategory[recipe.category] = [];
            }
            recipesByCategory[recipe.category].push(recipe);
          }
        });

        // 创建每周膳食计划
        const mealPlan: MealPlan = {
          weekdays: [],
          weekend: [],
          groceryList: {
            ingredients: [],
            shoppingPlan: {
              fresh: [],
              pantry: [],
              spices: [],
              others: [],
            },
          },
        };

        // 用于跟踪已经选择的菜谱，以便后续处理食材信息
        const selectedRecipes: Recipe[] = [];

        // 周一至周五
        for (let i = 0; i < 5; i++) {
          const dayPlan: DayPlan = {
            day: ['周一', '周二', '周三', '周四', '周五'][i],
            breakfast: [],
            lunch: [],
            dinner: [],
          };

          // 早餐 - 根据人数推荐1-2个早餐菜单
          const breakfastCount = Math.max(1, Math.ceil(peopleCount / 5));
          for (
            let j = 0;
            j < breakfastCount &&
            recipesByCategory['早餐'] &&
            recipesByCategory['早餐'].length > 0;
            j++
          ) {
            const breakfastIndex = Math.floor(
              Math.random() * recipesByCategory['早餐'].length
            );
            const selectedRecipe = recipesByCategory['早餐'][breakfastIndex];
            selectedRecipes.push(selectedRecipe);
            dayPlan.breakfast.push(
              this.cookbook.simplifyRecipe(selectedRecipe)
            );
            // 避免重复，从候选列表中移除
            recipesByCategory['早餐'] = recipesByCategory['早餐'].filter(
              (_, idx) => idx !== breakfastIndex
            );
          }

          // 午餐和晚餐的菜谱数量，根据人数确定
          const mealCount = Math.max(2, Math.ceil(peopleCount / 3));

          // 午餐
          for (let j = 0; j < mealCount; j++) {
            // 随机选择菜系：主食、水产、蔬菜、荤菜等
            const categories = ['主食', '水产', '荤菜', '素菜', '甜品'];
            let selectedCategory =
              categories[Math.floor(Math.random() * categories.length)];

            // 如果该分类没有菜谱或已用完，尝试其他分类
            while (
              !recipesByCategory[selectedCategory] ||
              recipesByCategory[selectedCategory].length === 0
            ) {
              selectedCategory =
                categories[Math.floor(Math.random() * categories.length)];
              if (
                categories.every(
                  (cat) =>
                    !recipesByCategory[cat] ||
                    recipesByCategory[cat].length === 0
                )
              ) {
                break; // 所有分类都没有可用菜谱，退出循环
              }
            }

            if (
              recipesByCategory[selectedCategory] &&
              recipesByCategory[selectedCategory].length > 0
            ) {
              const index = Math.floor(
                Math.random() * recipesByCategory[selectedCategory].length
              );
              const selectedRecipe = recipesByCategory[selectedCategory][index];
              selectedRecipes.push(selectedRecipe);
              dayPlan.lunch.push(this.cookbook.simplifyRecipe(selectedRecipe));
              // 避免重复，从候选列表中移除
              recipesByCategory[selectedCategory] = recipesByCategory[
                selectedCategory
              ].filter((_, idx) => idx !== index);
            }
          }

          // 晚餐
          for (let j = 0; j < mealCount; j++) {
            // 随机选择菜系，与午餐类似但可添加汤羹
            const categories = ['主食', '水产', '荤菜', '素菜', '甜品', '汤羹'];
            let selectedCategory =
              categories[Math.floor(Math.random() * categories.length)];

            // 如果该分类没有菜谱或已用完，尝试其他分类
            while (
              !recipesByCategory[selectedCategory] ||
              recipesByCategory[selectedCategory].length === 0
            ) {
              selectedCategory =
                categories[Math.floor(Math.random() * categories.length)];
              if (
                categories.every(
                  (cat) =>
                    !recipesByCategory[cat] ||
                    recipesByCategory[cat].length === 0
                )
              ) {
                break; // 所有分类都没有可用菜谱，退出循环
              }
            }

            if (
              recipesByCategory[selectedCategory] &&
              recipesByCategory[selectedCategory].length > 0
            ) {
              const index = Math.floor(
                Math.random() * recipesByCategory[selectedCategory].length
              );
              const selectedRecipe = recipesByCategory[selectedCategory][index];
              selectedRecipes.push(selectedRecipe);
              dayPlan.dinner.push(this.cookbook.simplifyRecipe(selectedRecipe));
              // 避免重复，从候选列表中移除
              recipesByCategory[selectedCategory] = recipesByCategory[
                selectedCategory
              ].filter((_, idx) => idx !== index);
            }
          }

          mealPlan.weekdays.push(dayPlan);
        }

        // 周六和周日
        for (let i = 0; i < 2; i++) {
          const dayPlan: DayPlan = {
            day: ['周六', '周日'][i],
            breakfast: [],
            lunch: [],
            dinner: [],
          };

          // 早餐 - 根据人数推荐菜品，至少2个菜品，随人数增加
          const breakfastCount = Math.max(2, Math.ceil(peopleCount / 3));
          for (
            let j = 0;
            j < breakfastCount &&
            recipesByCategory['早餐'] &&
            recipesByCategory['早餐'].length > 0;
            j++
          ) {
            const breakfastIndex = Math.floor(
              Math.random() * recipesByCategory['早餐'].length
            );
            const selectedRecipe = recipesByCategory['早餐'][breakfastIndex];
            selectedRecipes.push(selectedRecipe);
            dayPlan.breakfast.push(
              this.cookbook.simplifyRecipe(selectedRecipe)
            );
            recipesByCategory['早餐'] = recipesByCategory['早餐'].filter(
              (_, idx) => idx !== breakfastIndex
            );
          }

          // 计算工作日的基础菜品数量
          const weekdayMealCount = Math.max(2, Math.ceil(peopleCount / 3));
          // 周末菜品数量：比工作日多1-2个菜，随人数增加
          const weekendAddition = peopleCount <= 4 ? 1 : 2; // 4人以下多1个菜，4人以上多2个菜
          const mealCount = weekdayMealCount + weekendAddition;

          const getMeals = (count: number): SimpleRecipe[] => {
            const result: SimpleRecipe[] = [];
            const categories = ['荤菜', '水产'];

            // 尽量平均分配不同分类的菜品
            for (let j = 0; j < count; j++) {
              const category = categories[j % categories.length];
              if (
                recipesByCategory[category] &&
                recipesByCategory[category].length > 0
              ) {
                const index = Math.floor(
                  Math.random() * recipesByCategory[category].length
                );
                const selectedRecipe = recipesByCategory[category][index];
                selectedRecipes.push(selectedRecipe);
                result.push(this.cookbook.simplifyRecipe(selectedRecipe));
                recipesByCategory[category] = recipesByCategory[
                  category
                ].filter((_, idx) => idx !== index);
              } else if (
                recipesByCategory['主食'] &&
                recipesByCategory['主食'].length > 0
              ) {
                // 如果没有足够的荤菜或水产，使用主食
                const index = Math.floor(
                  Math.random() * recipesByCategory['主食'].length
                );
                const selectedRecipe = recipesByCategory['主食'][index];
                selectedRecipes.push(selectedRecipe);
                result.push(this.cookbook.simplifyRecipe(selectedRecipe));
                recipesByCategory['主食'] = recipesByCategory['主食'].filter(
                  (_, idx) => idx !== index
                );
              }
            }

            return result;
          };

          dayPlan.lunch = getMeals(mealCount);
          dayPlan.dinner = getMeals(mealCount);

          mealPlan.weekend.push(dayPlan);
        }

        // 统计食材清单，收集所有菜谱的所有食材
        const ingredientMap = new Map<
          string,
          {
            totalQuantity: number | null;
            unit: string | null;
            recipeCount: number;
            recipes: string[];
          }
        >();

        // 处理所有菜谱
        selectedRecipes.forEach((recipe) =>
          this.cookbook.processRecipeIngredients(recipe, ingredientMap)
        );

        // 整理食材清单
        for (const [name, info] of ingredientMap.entries()) {
          mealPlan.groceryList.ingredients.push({
            name,
            totalQuantity: info.totalQuantity,
            unit: info.unit,
            recipeCount: info.recipeCount,
            recipes: info.recipes,
          });
        }

        // 对食材按使用频率排序
        mealPlan.groceryList.ingredients.sort(
          (a, b) => b.recipeCount - a.recipeCount
        );

        // 生成购物计划，根据食材类型进行分类
        this.cookbook.categorizeIngredients(
          mealPlan.groceryList.ingredients,
          mealPlan.groceryList.shoppingPlan
        );

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(mealPlan, null, 2),
            },
          ],
        };
      }
    );
  }

  private registerWhatToEatTool() {
    const recipes = this.cookbook.recipes;

    this.server.tool(
      'mcp_howtocook_whatToEat',
      '不知道吃什么？根据人数直接推荐适合的菜品组合',
      {
        peopleCount: z
          .number()
          .int()
          .min(1)
          .max(10)
          .describe('用餐人数，1-10之间的整数，会根据人数推荐合适数量的菜品'),
      },
      async ({ peopleCount }: { peopleCount: number }) => {
        // 根据人数计算荤素菜数量
        const vegetableCount = Math.floor((peopleCount + 1) / 2);
        const meatCount = Math.ceil((peopleCount + 1) / 2);

        // 获取所有荤菜
        let meatDishes = recipes.filter(
          (recipe) => recipe.category === '荤菜' || recipe.category === '水产'
        );

        // 获取其他可能的菜品（当做素菜）
        let vegetableDishes = recipes.filter(
          (recipe) =>
            recipe.category !== '荤菜' &&
            recipe.category !== '水产' &&
            recipe.category !== '早餐' &&
            recipe.category !== '主食'
        );

        // 特别处理：如果人数超过8人，增加鱼类荤菜
        let recommendedDishes: Recipe[] = [];
        let fishDish: Recipe | null = null;

        if (peopleCount > 8) {
          const fishDishes = recipes.filter(
            (recipe) => recipe.category === '水产'
          );
          if (fishDishes.length > 0) {
            fishDish =
              fishDishes[Math.floor(Math.random() * fishDishes.length)];
            recommendedDishes.push(fishDish!);
          }
        }

        // 按照不同肉类的优先级选择荤菜
        const meatTypes = ['猪肉', '鸡肉', '牛肉', '羊肉', '鸭肉', '鱼肉'];
        const selectedMeatDishes: Recipe[] = [];

        // 需要选择的荤菜数量
        const remainingMeatCount = fishDish ? meatCount - 1 : meatCount;

        // 尝试按照肉类优先级选择荤菜
        for (const meatType of meatTypes) {
          if (selectedMeatDishes.length >= remainingMeatCount) break;

          const meatTypeOptions = meatDishes.filter((dish) => {
            // 检查菜品的材料是否包含这种肉类
            return dish.ingredients?.some((ingredient: any) => {
              const name = ingredient.name?.toLowerCase() || '';
              return name.includes(meatType.toLowerCase());
            });
          });

          if (meatTypeOptions.length > 0) {
            // 随机选择一道这种肉类的菜
            const selected =
              meatTypeOptions[
                Math.floor(Math.random() * meatTypeOptions.length)
              ];
            selectedMeatDishes.push(selected);
            // 从可选列表中移除，避免重复选择
            meatDishes = meatDishes.filter((dish) => dish.id !== selected.id);
          }
        }

        // 如果通过肉类筛选的荤菜不够，随机选择剩余的
        while (
          selectedMeatDishes.length < remainingMeatCount &&
          meatDishes.length > 0
        ) {
          const randomIndex = Math.floor(Math.random() * meatDishes.length);
          selectedMeatDishes.push(meatDishes[randomIndex]);
          meatDishes.splice(randomIndex, 1);
        }

        // 随机选择素菜
        const selectedVegetableDishes: Recipe[] = [];
        while (
          selectedVegetableDishes.length < vegetableCount &&
          vegetableDishes.length > 0
        ) {
          const randomIndex = Math.floor(
            Math.random() * vegetableDishes.length
          );
          selectedVegetableDishes.push(vegetableDishes[randomIndex]);
          vegetableDishes.splice(randomIndex, 1);
        }

        // 合并推荐菜单
        recommendedDishes = recommendedDishes.concat(
          selectedMeatDishes,
          selectedVegetableDishes
        );

        // 构建推荐结果
        const recommendationDetails: DishRecommendation = {
          peopleCount,
          meatDishCount: selectedMeatDishes.length + (fishDish ? 1 : 0),
          vegetableDishCount: selectedVegetableDishes.length,
          dishes: recommendedDishes.map(this.cookbook.simplifyRecipe),
          message: `为${peopleCount}人推荐的菜品，包含${
            selectedMeatDishes.length + (fishDish ? 1 : 0)
          }个荤菜和${selectedVegetableDishes.length}个素菜。`,
        };

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(recommendationDetails, null, 2),
            },
          ],
        };
      }
    );
  }
}
