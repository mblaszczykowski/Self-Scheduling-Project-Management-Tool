package com.backend.util;

import com.backend.dtos.TaskDTO;
import com.backend.entities.TaskPriority;
import com.backend.entities.TaskStatus;
import org.junit.jupiter.api.*;

import java.time.LocalDate;
import java.util.*;

/**
 * Experiment 11: Statistical significance of MORCPSP advantage over FIFO/SPT.
 *
 * Runs NUM_SEEDS independent simulations (different random seeds) and applies:
 *  - Paired Wilcoxon signed-rank test (non-parametric)
 *  - Paired t-test (parametric)
 *  - Cohen's d (effect size)
 *
 * Null hypothesis H0: MORCPSP and baseline produce equal Z values.
 * Alternative H1: MORCPSP produces lower Z than baseline.
 */
@DisplayName("Chapter 5 / Experiment 11: Statistical significance")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class ScheduleOptimizerStatisticalTest {

    private final ScheduleOptimizer optimizer = new ScheduleOptimizer();
    private static final LocalDate HORIZON = LocalDate.of(2025, 1, 1);
    private static final double ALPHA = 0.8;
    private static final double BETA = 0.2;
    private static final int NUM_SEEDS = 100;

    @Test
    @Order(1)
    @DisplayName("11.1: Wilcoxon signed-rank test and Cohen's d on 100 independent simulations")
    void experiment11_statisticalSignificance() {
        double[] zMorcpsp = new double[NUM_SEEDS];
        double[] zFifo = new double[NUM_SEEDS];
        double[] zSpt = new double[NUM_SEEDS];
        double[] hMorcpsp = new double[NUM_SEEDS];
        double[] hFifo = new double[NUM_SEEDS];
        double[] hSpt = new double[NUM_SEEDS];

        for (int seed = 0; seed < NUM_SEEDS; seed++) {
            List<TaskDTO> tasks = generatePortfolioWithSeed(3, 15, 3, 0.60, seed);
            var morcpsp = optimizer.optimize(tasks, HORIZON, ALPHA, BETA);
            var fifo = optimizer.optimizeFIFO(tasks, HORIZON, ALPHA, BETA);
            var spt = optimizer.optimizeSPT(tasks, HORIZON, ALPHA, BETA);
            zMorcpsp[seed] = morcpsp.objectiveValue();
            zFifo[seed] = fifo.objectiveValue();
            zSpt[seed] = spt.objectiveValue();
            hMorcpsp[seed] = avgTardinessOfPriority(tasks, morcpsp, TaskPriority.HIGHEST);
            hFifo[seed] = avgTardinessOfPriority(tasks, fifo, TaskPriority.HIGHEST);
            hSpt[seed] = avgTardinessOfPriority(tasks, spt, TaskPriority.HIGHEST);
        }

        System.out.println("\n=== Experiment 11: Statistical significance (n=" + NUM_SEEDS + ") ===\n");

        System.out.println("--- Descriptive statistics ---");
        System.out.printf("%-18s | %s%n", "Strategy", "Z (mean ± std)   | HIGHEST tard (mean ± std)");
        System.out.printf("%-18s | %7.1f ± %6.1f | %5.2f ± %5.2f%n", "FIFO", mean(zFifo), std(zFifo), mean(hFifo), std(hFifo));
        System.out.printf("%-18s | %7.1f ± %6.1f | %5.2f ± %5.2f%n", "SPT", mean(zSpt), std(zSpt), mean(hSpt), std(hSpt));
        System.out.printf("%-18s | %7.1f ± %6.1f | %5.2f ± %5.2f%n", "MORCPSP", mean(zMorcpsp), std(zMorcpsp), mean(hMorcpsp), std(hMorcpsp));

        System.out.println("\n--- Paired tests: MORCPSP vs FIFO on Z ---");
        runAllTests(zMorcpsp, zFifo);

        System.out.println("\n--- Paired tests: MORCPSP vs SPT on Z ---");
        runAllTests(zMorcpsp, zSpt);

        System.out.println("\n--- Paired tests: MORCPSP vs FIFO on HIGHEST tardiness ---");
        runAllTests(hMorcpsp, hFifo);

        System.out.println("\n--- Paired tests: MORCPSP vs SPT on HIGHEST tardiness ---");
        runAllTests(hMorcpsp, hSpt);

        System.out.println("\n--- Win rate (lower Z = win) ---");
        int winsVsFifo = 0, tiesVsFifo = 0, winsVsSpt = 0, tiesVsSpt = 0;
        for (int i = 0; i < NUM_SEEDS; i++) {
            if (zMorcpsp[i] < zFifo[i]) winsVsFifo++;
            else if (zMorcpsp[i] == zFifo[i]) tiesVsFifo++;
            if (zMorcpsp[i] < zSpt[i]) winsVsSpt++;
            else if (zMorcpsp[i] == zSpt[i]) tiesVsSpt++;
        }
        System.out.printf("MORCPSP wins vs FIFO: %d/%d (%.1f%%), ties: %d%n",
                winsVsFifo, NUM_SEEDS, 100.0 * winsVsFifo / NUM_SEEDS, tiesVsFifo);
        System.out.printf("MORCPSP wins vs SPT:  %d/%d (%.1f%%), ties: %d%n",
                winsVsSpt, NUM_SEEDS, 100.0 * winsVsSpt / NUM_SEEDS, tiesVsSpt);
    }

    private void runAllTests(double[] morcpsp, double[] baseline) {
        // Wilcoxon signed-rank (two-sided)
        double[] wilcox = wilcoxonSignedRank(morcpsp, baseline);
        double z = wilcox[0];
        double pWilcox = wilcox[1];

        // Paired t-test
        double[] tTest = pairedTTest(morcpsp, baseline);
        double t = tTest[0];
        double pT = tTest[1];
        int df = (int) tTest[2];

        // Cohen's d (paired)
        double d = pairedCohensD(morcpsp, baseline);

        System.out.printf("  Wilcoxon:   z = %7.3f   p = %s   %s%n",
                z, formatP(pWilcox), significanceLabel(pWilcox));
        System.out.printf("  Paired t:   t = %7.3f   p = %s   df = %d   %s%n",
                t, formatP(pT), df, significanceLabel(pT));
        System.out.printf("  Cohen's d:  d = %7.3f   (%s effect, favoring %s)%n",
                d, cohenLabel(Math.abs(d)), d < 0 ? "MORCPSP" : "baseline");
    }

    // ---------- Statistical tests (pure Java, no external libraries) ----------

    /**
     * Two-sided paired Wilcoxon signed-rank test.
     * Returns {z-score, two-sided p-value}.
     */
    private double[] wilcoxonSignedRank(double[] a, double[] b) {
        int n = a.length;
        List<Double> diffs = new ArrayList<>();
        for (int i = 0; i < n; i++) {
            double d = a[i] - b[i];
            if (d != 0) diffs.add(d);
        }
        int m = diffs.size();
        if (m == 0) return new double[]{0.0, 1.0};

        // Rank absolute differences (with tie-averaging)
        Integer[] idx = new Integer[m];
        for (int i = 0; i < m; i++) idx[i] = i;
        Arrays.sort(idx, Comparator.comparingDouble(i -> Math.abs(diffs.get(i))));

        double[] ranks = new double[m];
        int i = 0;
        while (i < m) {
            int j = i;
            while (j < m && Math.abs(diffs.get(idx[j])) == Math.abs(diffs.get(idx[i]))) j++;
            double avgRank = (i + 1 + j) / 2.0; // average of ranks i+1..j
            for (int k = i; k < j; k++) ranks[idx[k]] = avgRank;
            i = j;
        }

        double wPlus = 0, wMinus = 0;
        for (int k = 0; k < m; k++) {
            if (diffs.get(k) > 0) wPlus += ranks[k];
            else wMinus += ranks[k];
        }

        double mean = m * (m + 1) / 4.0;
        double stdDev = Math.sqrt(m * (m + 1) * (2.0 * m + 1) / 24.0);
        double z = (wPlus - mean) / stdDev;
        double p = 2 * (1 - standardNormalCdf(Math.abs(z)));
        return new double[]{z, Math.max(p, 1e-300)};
    }

    /**
     * Two-sided paired t-test.
     * Returns {t-statistic, two-sided p-value, degrees of freedom}.
     */
    private double[] pairedTTest(double[] a, double[] b) {
        int n = a.length;
        double[] diffs = new double[n];
        for (int i = 0; i < n; i++) diffs[i] = a[i] - b[i];
        double meanD = mean(diffs);
        double stdD = std(diffs);
        double se = stdD / Math.sqrt(n);
        double t = meanD / se;
        int df = n - 1;
        // For large df (> 30) t-distribution is close to normal
        double p = 2 * (1 - standardNormalCdf(Math.abs(t)));
        return new double[]{t, Math.max(p, 1e-300), df};
    }

    /**
     * Cohen's d for paired samples: d_z = mean(diff) / std(diff).
     */
    private double pairedCohensD(double[] a, double[] b) {
        int n = a.length;
        double[] diffs = new double[n];
        for (int i = 0; i < n; i++) diffs[i] = a[i] - b[i];
        double m = mean(diffs);
        double s = std(diffs);
        if (s == 0) return 0;
        return m / s;
    }

    /**
     * Standard normal CDF via Abramowitz-Stegun approximation (error < 7.5e-8).
     */
    private double standardNormalCdf(double x) {
        double t = 1.0 / (1.0 + 0.2316419 * Math.abs(x));
        double phi = Math.exp(-x * x / 2.0) / Math.sqrt(2 * Math.PI);
        double k = phi * (0.319381530 * t
                - 0.356563782 * t * t
                + 1.781477937 * t * t * t
                - 1.821255978 * t * t * t * t
                + 1.330274429 * t * t * t * t * t);
        return x >= 0 ? 1 - k : k;
    }

    private String cohenLabel(double d) {
        if (d < 0.2) return "negligible";
        if (d < 0.5) return "small";
        if (d < 0.8) return "medium";
        if (d < 1.2) return "large";
        return "very large";
    }

    private String significanceLabel(double p) {
        if (p < 0.001) return "*** (p < 0.001)";
        if (p < 0.01) return "**  (p < 0.01)";
        if (p < 0.05) return "*   (p < 0.05)";
        return "n.s.";
    }

    private String formatP(double p) {
        if (p < 1e-10) return "< 1e-10";
        if (p < 0.001) return String.format("%.2e", p);
        return String.format("%.4f", p);
    }

    private double mean(double[] arr) {
        double s = 0;
        for (double v : arr) s += v;
        return s / arr.length;
    }

    private double std(double[] arr) {
        double m = mean(arr);
        double sq = 0;
        for (double v : arr) sq += (v - m) * (v - m);
        return Math.sqrt(sq / (arr.length - 1)); // sample std
    }

    private double avgTardinessOfPriority(List<TaskDTO> tasks, ScheduleOptimizer.ScheduleResult result, TaskPriority priority) {
        double sum = 0;
        int count = 0;
        for (TaskDTO t : tasks) {
            if (t.priority() != priority) continue;
            var s = result.tasks().get(t.taskKey());
            if (s == null) continue;
            sum += s.tardinessDays();
            count++;
        }
        return count == 0 ? 0 : sum / count;
    }

    // ---------- Portfolio generation (same pattern as ExperimentTest) ----------

    private List<TaskDTO> generatePortfolioWithSeed(int numProjects, int tasksPerProject,
                                                    int numResources, double conflictRatio, int seed) {
        Random rng = new Random(seed);
        List<TaskDTO> tasks = new ArrayList<>();
        TaskPriority[] priorities = TaskPriority.values();
        double[] cumDist = {0.10, 0.30, 0.70, 0.90, 1.00}; // HIGHEST, HIGH, MEDIUM, LOW, LOWEST

        for (int p = 0; p < numProjects; p++) {
            String projKey = "P" + (char) ('A' + p);
            for (int t = 0; t < tasksPerProject; t++) {
                String key = projKey + "-" + (t + 1);
                int dur = 2 + rng.nextInt(7);
                int startOffset = rng.nextDouble() < conflictRatio
                        ? rng.nextInt(5)
                        : t * 3 + rng.nextInt(3);
                LocalDate start = HORIZON.plusDays(startOffset);
                LocalDate end = start.plusDays(dur);
                String assignee = "dev" + (rng.nextInt(numResources) + 1) + "@company.com";
                double r = rng.nextDouble();
                TaskPriority priority = TaskPriority.MEDIUM;
                for (int i = 0; i < cumDist.length; i++) {
                    if (r < cumDist[i]) {
                        priority = priorities[4 - i]; // reversed: HIGHEST=0→index 4
                        break;
                    }
                }
                List<String> deps = new ArrayList<>();
                if (t > 0 && rng.nextDouble() < 0.30) {
                    deps.add(projKey + "-" + (1 + rng.nextInt(t)));
                }
                tasks.add(new TaskDTO(null, null, key, projKey, key, null,
                        TaskStatus.IN_PROGRESS, start, end, assignee,
                        null, deps, null, null, null, null, null, priority));
            }
        }
        return tasks;
    }
}
