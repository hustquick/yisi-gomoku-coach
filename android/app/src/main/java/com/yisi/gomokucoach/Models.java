package com.yisi.gomokucoach;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

final class Stone {
    final int x, y, player;
    Stone(int x, int y, int player) { this.x = x; this.y = y; this.player = player; }
}

final class EngineLine {
    int rank, depth;
    Integer eval, mate;
    boolean mateWin, mateLoss;
    Double winRate;
    final List<int[]> pv = new ArrayList<>();

    double strength() {
        if (mateWin) return 1_000_000;
        if (mate != null && mate > 0) return 1_000_000 - mate;
        if (mateLoss) return -1_000_000;
        if (mate != null && mate < 0) return -1_000_000 + Math.abs(mate);
        if (eval != null) return eval;
        return winRate == null ? -Double.MAX_VALUE : (winRate - 0.5) * 1000;
    }

    String scoreText() {
        if (mateWin || (mate != null && mate > 0)) return "本方胜势" + (mate == null ? "" : " M" + mate);
        if (mateLoss || (mate != null && mate < 0)) return "本方败势" + (mate == null ? "" : " M" + Math.abs(mate));
        return eval == null ? "待计算" : String.format("%+.2f", eval / 100.0);
    }
}

final class RapfiOutput {
    private static final Pattern COORD = Pattern.compile("(\\d+),(\\d+)");

    static List<EngineLine> parse(String raw) {
        Map<Integer, EngineLine> completed = new LinkedHashMap<>();
        EngineLine current = null;
        for (String source : raw.split("\\R")) {
            String line = source.trim();
            Matcher match;
            if ((match = Pattern.compile("^INFO PV (\\d+)$").matcher(line)).find()) {
                current = new EngineLine(); current.rank = Integer.parseInt(match.group(1)) + 1;
            } else if (current != null && (match = Pattern.compile("^INFO DEPTH (\\d+)$").matcher(line)).find()) {
                current.depth = Integer.parseInt(match.group(1));
            } else if (current != null && (match = Pattern.compile("^INFO EVAL ([+-]?\\d+)$").matcher(line)).find()) {
                current.eval = Integer.parseInt(match.group(1));
            } else if (current != null && (match = Pattern.compile("^INFO EVAL ([+-])M(\\d+|\\*)$").matcher(line)).find()) {
                if ("*".equals(match.group(2))) { current.mateWin = "+".equals(match.group(1)); current.mateLoss = !current.mateWin; }
                else current.mate = ("+".equals(match.group(1)) ? 1 : -1) * Integer.parseInt(match.group(2));
            } else if (current != null && (match = Pattern.compile("^INFO WINRATE ([\\d.]+)$").matcher(line)).find()) {
                current.winRate = Double.parseDouble(match.group(1));
            } else if (current != null && line.startsWith("INFO BESTLINE ")) {
                Matcher coordinate = COORD.matcher(line.substring(14));
                while (coordinate.find()) current.pv.add(new int[]{Integer.parseInt(coordinate.group(1)), Integer.parseInt(coordinate.group(2))});
            } else if (current != null && "INFO PV DONE".equals(line)) {
                if (!current.pv.isEmpty()) completed.put(current.rank, current);
                current = null;
            }
        }
        List<EngineLine> result = new ArrayList<>(completed.values());
        result.sort(Comparator.comparingDouble(EngineLine::strength).reversed().thenComparingInt(line -> line.rank));
        return result;
    }
}
