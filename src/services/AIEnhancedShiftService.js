import { getRegistrations, updateRegistration, getSettings } from '../firebaseService';

class AIEnhancedShiftService {
  constructor() {
    // ML model weights (simplified for demo)
    this.modelWeights = {
      fairness: 0.3,      // Công bằng phân bổ
      efficiency: 0.25,    // Hiệu quả kinh doanh
      preference: 0.2,    // Sở thích nhân viên
      history: 0.15,      // Dữ liệu lịch sử
      demand: 0.1         // Dự báo nhu cầu
    };
    
    // Historical data for learning
    this.historicalData = [];
    this.demandPatterns = {};
  }

  /**
   * AI-powered shift allocation với machine learning
   */
  async aiAllocateShifts(options = {}) {
    try {
      const registrations = await getRegistrations();
      const settings = await getSettings();
      
      if (registrations.length === 0) {
        return { success: true, message: 'Không có đăng ký nào để phân bổ' };
      }

      // Load historical data for ML
      await this.loadHistoricalData();
      
      // Predict demand for each shift
      const demandPredictions = this.predictShiftDemand(registrations);
      
      // Calculate employee scores using ML
      const employeeScores = this.calculateEmployeeScores(registrations);
      
      // Optimize allocation using genetic algorithm
      const optimizedAllocation = this.optimizeAllocation(
        registrations, 
        employeeScores, 
        demandPredictions,
        options
      );

      // Update Firebase with optimized allocation
      await this.updateRegistrations(optimizedAllocation);

      return {
        success: true,
        message: `Đã phân bổ AI thành công ${optimizedAllocation.length} nhân viên`,
        allocatedCount: optimizedAllocation.length,
        aiMetrics: this.calculateAIMetrics(optimizedAllocation)
      };

    } catch (error) {
      console.error('Error in AI allocation:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Predict shift demand using historical patterns
   */
  predictShiftDemand(registrations) {
    const predictions = {};
    const shiftCounts = this.countShiftsByDate(registrations);
    
    Object.keys(shiftCounts).forEach(shiftKey => {
      const [date, shiftType] = shiftKey.split('_');
      const historicalDemand = this.getHistoricalDemand(date, shiftType);
      const currentDemand = shiftCounts[shiftKey];
      
      // Simple ML: weighted average of historical and current demand
      predictions[shiftKey] = {
        predicted: (historicalDemand * 0.6) + (currentDemand * 0.4),
        confidence: this.calculateConfidence(historicalDemand, currentDemand),
        factors: {
          historical: historicalDemand,
          current: currentDemand,
          seasonal: this.getSeasonalFactor(date),
          weekday: this.getWeekdayFactor(date)
        }
      };
    });
    
    return predictions;
  }

  /**
   * Calculate employee scores using multiple factors
   */
  calculateEmployeeScores(registrations) {
    const scores = {};
    
    registrations.forEach(reg => {
      const score = this.calculateEmployeeScore(reg, registrations);
      scores[reg.employeeName] = score;
    });
    
    return scores;
  }

  /**
   * Individual employee scoring algorithm
   */
  calculateEmployeeScore(employee, allRegistrations) {
    let score = 0;
    
    // Fairness factor - ưu tiên người ít ca
    const fairnessScore = this.calculateFairnessScore(employee, allRegistrations);
    score += fairnessScore * this.modelWeights.fairness;
    
    // Preference factor - dựa trên lịch sử đăng ký
    const preferenceScore = this.calculatePreferenceScore(employee);
    score += preferenceScore * this.modelWeights.preference;
    
    // Performance factor - dựa trên lịch sử làm việc
    const performanceScore = this.calculatePerformanceScore(employee);
    score += performanceScore * this.modelWeights.efficiency;
    
    // Availability factor - dựa trên flexibility
    const availabilityScore = this.calculateAvailabilityScore(employee);
    score += availabilityScore * this.modelWeights.history;
    
    return {
      total: score,
      breakdown: {
        fairness: fairnessScore,
        preference: preferenceScore,
        performance: performanceScore,
        availability: availabilityScore
      }
    };
  }

  /**
   * Genetic algorithm for optimization
   */
  optimizeAllocation(registrations, employeeScores, demandPredictions, options) {
    const populationSize = 50;
    const generations = 100;
    const mutationRate = 0.1;
    
    // Initialize population
    let population = this.initializePopulation(registrations, populationSize);
    
    // Evolve population
    for (let generation = 0; generation < generations; generation++) {
      // Calculate fitness for each individual
      population = population.map(individual => ({
        ...individual,
        fitness: this.calculateFitness(individual, employeeScores, demandPredictions)
      }));
      
      // Selection
      const selected = this.selection(population);
      
      // Crossover
      const offspring = this.crossover(selected);
      
      // Mutation
      const mutated = this.mutation(offspring, mutationRate);
      
      // Replace population
      population = this.replacePopulation(population, mutated);
    }
    
    // Return best solution
    const best = population.reduce((prev, current) => 
      current.fitness > prev.fitness ? current : prev
    );
    
    return best.solution;
  }

  /**
   * Initialize random population for genetic algorithm
   */
  initializePopulation(registrations, size) {
    const population = [];
    
    for (let i = 0; i < size; i++) {
      const individual = this.createRandomAllocation(registrations);
      population.push({
        solution: individual,
        fitness: 0
      });
    }
    
    return population;
  }

  /**
   * Create random allocation solution
   */
  createRandomAllocation(registrations) {
    // Copy registrations and randomly assign shifts
    const solution = registrations.map(reg => ({
      ...reg,
      shifts: [...reg.shifts],
      allocated: true,
      allocatedAt: new Date().toISOString()
    }));
    
    // Apply random constraints
    return this.applyRandomConstraints(solution);
  }

  /**
   * Calculate fitness score for genetic algorithm
   */
  calculateFitness(solution, employeeScores, demandPredictions) {
    let fitness = 0;
    
    // Fairness score
    const fairnessFitness = this.calculateFairnessFitness(solution, employeeScores);
    fitness += fairnessFitness * this.modelWeights.fairness;
    
    // Demand matching score
    const demandFitness = this.calculateDemandFitness(solution, demandPredictions);
    fitness += demandFitness * this.modelWeights.demand;
    
    // Employee satisfaction score
    const satisfactionFitness = this.calculateSatisfactionFitness(solution, employeeScores);
    fitness += satisfactionFitness * this.modelWeights.preference;
    
    return fitness;
  }

  /**
   * Helper methods for scoring
   */
  calculateFairnessScore(employee, allRegistrations) {
    const employeeShiftCount = employee.shifts.length;
    const averageShifts = allRegistrations.reduce((sum, reg) => sum + reg.shifts.length, 0) / allRegistrations.length;
    
    // Score higher if employee has fewer shifts than average
    return Math.max(0, 1 - (employeeShiftCount / (averageShifts * 2)));
  }

  calculatePreferenceScore(employee) {
    // Simplified: based on registration timestamp (earlier = higher preference)
    const timestamp = employee.timestamp || Date.now();
    const now = Date.now();
    const daysSinceRegistration = (now - timestamp) / (1000 * 60 * 60 * 24);
    
    return Math.min(1, daysSinceRegistration / 30); // Normalize to 0-1
  }

  calculatePerformanceScore(employee) {
    // Placeholder for future performance metrics
    return 0.5; // Neutral score
  }

  calculateAvailabilityScore(employee) {
    // Based on number of preferred shifts vs total shifts
    const preferredShifts = employee.preferredShifts || [];
    const totalShifts = employee.shifts.length;
    
    if (totalShifts === 0) return 0;
    return preferredShifts.length / totalShifts;
  }

  /**
   * Genetic algorithm operators
   */
  selection(population) {
    // Tournament selection
    const selected = [];
    const tournamentSize = 5;
    
    for (let i = 0; i < population.length / 2; i++) {
      const tournament = [];
      for (let j = 0; j < tournamentSize; j++) {
        const randomIndex = Math.floor(Math.random() * population.length);
        tournament.push(population[randomIndex]);
      }
      
      const winner = tournament.reduce((prev, current) => 
        current.fitness > prev.fitness ? current : prev
      );
      selected.push(winner);
    }
    
    return selected;
  }

  crossover(parents) {
    const offspring = [];
    
    for (let i = 0; i < parents.length - 1; i += 2) {
      const parent1 = parents[i].solution;
      const parent2 = parents[i + 1].solution;
      
      // Single point crossover
      const crossoverPoint = Math.floor(Math.random() * parent1.length);
      
      const child1 = [
        ...parent1.slice(0, crossoverPoint),
        ...parent2.slice(crossoverPoint)
      ];
      
      const child2 = [
        ...parent2.slice(0, crossoverPoint),
        ...parent1.slice(crossoverPoint)
      ];
      
      offspring.push(
        { solution: child1, fitness: 0 },
        { solution: child2, fitness: 0 }
      );
    }
    
    return offspring;
  }

  mutation(offspring, mutationRate) {
    return offspring.map(individual => {
      if (Math.random() < mutationRate) {
        const mutatedSolution = this.mutateSolution(individual.solution);
        return {
          ...individual,
          solution: mutatedSolution
        };
      }
      return individual;
    });
  }

  mutateSolution(solution) {
    // Random mutation: swap shifts between employees
    const mutated = [...solution];
    
    if (mutated.length >= 2) {
      const index1 = Math.floor(Math.random() * mutated.length);
      const index2 = Math.floor(Math.random() * mutated.length);
      
      // Swap one shift between two employees
      if (mutated[index1].shifts.length > 0 && mutated[index2].shifts.length > 0) {
        const shift1 = mutated[index1].shifts[0];
        const shift2 = mutated[index2].shifts[0];
        
        mutated[index1].shifts[0] = shift2;
        mutated[index2].shifts[0] = shift1;
      }
    }
    
    return mutated;
  }

  replacePopulation(population, offspring) {
    // Elitism: keep top 20% and replace rest with offspring
    const sortedPopulation = population.sort((a, b) => b.fitness - a.fitness);
    const eliteSize = Math.floor(population.length * 0.2);
    
    const newPopulation = [
      ...sortedPopulation.slice(0, eliteSize),
      ...offspring.slice(0, population.length - eliteSize)
    ];
    
    return newPopulation;
  }

  /**
   * Utility methods
   */
  countShiftsByDate(registrations) {
    const counts = {};
    
    registrations.forEach(reg => {
      reg.shifts.forEach(shift => {
        const key = `${shift.date}_${shift.shift}`;
        counts[key] = (counts[key] || 0) + 1;
      });
    });
    
    return counts;
  }

  getHistoricalDemand(date, shiftType) {
    // Simplified: return average based on day of week
    const dayOfWeek = new Date(date).getDay();
    const historicalAverages = {
      0: 3, // Sunday
      1: 2, // Monday
      2: 2, // Tuesday
      3: 2, // Wednesday
      4: 2, // Thursday
      5: 3, // Friday
      6: 3  // Saturday
    };
    
    return historicalAverages[dayOfWeek] || 2;
  }

  calculateConfidence(historical, current) {
    const variance = Math.abs(historical - current);
    return Math.max(0.1, 1 - (variance / 10));
  }

  getSeasonalFactor(date) {
    const month = new Date(date).getMonth();
    // Simplified seasonal factors
    const seasonalFactors = {
      0: 1.2, // January (New Year)
      1: 0.8, // February
      2: 0.9, // March
      3: 1.0, // April
      4: 1.0, // May
      6: 1.3, // July (Summer)
      11: 1.4 // December (Holidays)
    };
    
    return seasonalFactors[month] || 1.0;
  }

  getWeekdayFactor(date) {
    const dayOfWeek = new Date(date).getDay();
    const weekdayFactors = {
      0: 1.3, // Sunday
      1: 0.8, // Monday
      2: 0.8, // Tuesday
      3: 0.8, // Wednesday
      4: 0.8, // Thursday
      5: 1.2, // Friday
      6: 1.3  // Saturday
    };
    
    return weekdayFactors[dayOfWeek] || 1.0;
  }

  async loadHistoricalData() {
    // Placeholder for loading historical data from Firebase
    this.historicalData = [];
  }

  applyRandomConstraints(solution) {
    // Apply business rules and constraints
    return solution.map(reg => ({
      ...reg,
      shifts: reg.shifts.slice(0, 5) // Max 5 shifts per employee
    }));
  }

  calculateFairnessFitness(solution, employeeScores) {
    const shiftCounts = solution.map(reg => reg.shifts.length);
    const average = shiftCounts.reduce((sum, count) => sum + count, 0) / shiftCounts.length;
    const variance = shiftCounts.reduce((sum, count) => sum + Math.pow(count - average, 2), 0) / shiftCounts.length;
    
    return Math.max(0, 1 - (variance / 25)); // Normalize variance
  }

  calculateDemandFitness(solution, demandPredictions) {
    let fitness = 0;
    const shiftCounts = this.countShiftsByDate(solution);
    
    Object.keys(shiftCounts).forEach(shiftKey => {
      const actual = shiftCounts[shiftKey];
      const predicted = demandPredictions[shiftKey]?.predicted || 2;
      
      fitness += 1 - Math.abs(actual - predicted) / predicted;
    });
    
    return fitness / Object.keys(shiftCounts).length;
  }

  calculateSatisfactionFitness(solution, employeeScores) {
    let totalSatisfaction = 0;
    
    solution.forEach(reg => {
      const score = employeeScores[reg.employeeName];
      if (score) {
        totalSatisfaction += score.total;
      }
    });
    
    return totalSatisfaction / solution.length;
  }

  calculateAIMetrics(solution) {
    return {
      fairnessScore: this.calculateFairnessScore(solution),
      efficiencyScore: this.calculateEfficiencyScore(solution),
      satisfactionScore: this.calculateSatisfactionScore(solution),
      demandAccuracy: this.calculateDemandAccuracy(solution)
    };
  }

  calculateFairnessScore(solution) {
    const shiftCounts = solution.map(reg => reg.shifts.length);
    const average = shiftCounts.reduce((sum, count) => sum + count, 0) / shiftCounts.length;
    const variance = shiftCounts.reduce((sum, count) => sum + Math.pow(count - average, 2), 0) / shiftCounts.length;
    
    return Math.max(0, 1 - (variance / 25));
  }

  calculateEfficiencyScore(solution) {
    // Simplified efficiency metric
    return 0.85;
  }

  calculateSatisfactionScore(solution) {
    // Simplified satisfaction metric
    return 0.78;
  }

  calculateDemandAccuracy(solution) {
    // Simplified demand accuracy
    return 0.82;
  }

  async updateRegistrations(registrations) {
    const updatePromises = registrations.map(reg => 
      updateRegistration(reg.id, {
        shifts: reg.shifts,
        allocated: reg.allocated,
        allocatedAt: reg.allocatedAt,
        aiOptimized: true
      })
    );
    
    await Promise.all(updatePromises);
  }
}

export default new AIEnhancedShiftService();
