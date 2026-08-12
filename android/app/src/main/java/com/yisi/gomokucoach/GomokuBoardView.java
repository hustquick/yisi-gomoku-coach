package com.yisi.gomokucoach;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RadialGradient;
import android.graphics.Shader;
import android.util.AttributeSet;
import android.view.MotionEvent;
import android.view.View;

import java.util.ArrayList;
import java.util.List;

final class GomokuBoardView extends View {
    interface Listener { void onPoint(int x, int y); }
    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final List<Stone> stones = new ArrayList<>();
    private final List<EngineLine> candidates = new ArrayList<>();
    private final List<int[]> preview = new ArrayList<>();
    private Listener listener;
    private boolean flipped, showBest;
    private int previewFirstPlayer = 1;
    private float left, top, grid;

    GomokuBoardView(Context context) { super(context); init(); }
    GomokuBoardView(Context context, AttributeSet attrs) { super(context, attrs); init(); }
    private void init() { setBackgroundColor(Color.TRANSPARENT); setContentDescription("十五路五子棋棋盘"); }

    void setListener(Listener value) { listener = value; }
    void setPosition(List<Stone> value) { stones.clear(); stones.addAll(value); invalidate(); }
    void setCandidates(List<EngineLine> value) { candidates.clear(); candidates.addAll(value); invalidate(); }
    void setPreview(List<int[]> value, int firstPlayer) {
        preview.clear(); preview.addAll(value); previewFirstPlayer = firstPlayer; invalidate();
    }
    void setFlipped(boolean value) { flipped = value; invalidate(); }
    void setShowBest(boolean value) { showBest = value; invalidate(); }

    @Override protected void onMeasure(int widthSpec, int heightSpec) {
        int width = MeasureSpec.getSize(widthSpec);
        int desired = width;
        setMeasuredDimension(width, resolveSize(desired, heightSpec));
    }

    @Override protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        float side = Math.min(getWidth() - dp(54), getHeight() - dp(42));
        left = (getWidth() - side) / 2f;
        top = dp(10);
        grid = side / 14f;
        paint.setStyle(Paint.Style.FILL); paint.setColor(Color.rgb(216, 176, 111));
        canvas.drawRoundRect(left - dp(9), top - dp(9), left + side + dp(9), top + side + dp(9), dp(5), dp(5), paint);
        paint.setStyle(Paint.Style.STROKE); paint.setStrokeWidth(dp(1)); paint.setColor(Color.rgb(91, 69, 42));
        for (int i = 0; i < 15; i++) {
            float p = i * grid;
            canvas.drawLine(left + p, top, left + p, top + side, paint);
            canvas.drawLine(left, top + p, left + side, top + p, paint);
        }
        paint.setStyle(Paint.Style.FILL); paint.setColor(Color.rgb(75, 57, 35));
        for (int[] point : new int[][]{{3,3},{11,3},{7,7},{3,11},{11,11}}) {
            canvas.drawCircle(left + point[0] * grid, top + point[1] * grid, dp(3), paint);
        }
        paint.setTextSize(dp(10)); paint.setTextAlign(Paint.Align.CENTER); paint.setColor(Color.rgb(115, 88, 53));
        for (int visual = 0; visual < 15; visual++) {
            int x = flipped ? 14 - visual : visual;
            int y = flipped ? 14 - visual : visual;
            canvas.drawText(String.valueOf((char)('A' + x)), left + visual * grid, top + side + dp(24), paint);
            String row = String.valueOf(15 - y);
            canvas.drawText(row, left - dp(17), top + visual * grid + dp(4), paint);
            canvas.drawText(row, left + side + dp(17), top + visual * grid + dp(4), paint);
        }
        if (showBest) drawCandidates(canvas);
        drawStones(canvas);
        drawPreview(canvas);
    }

    private void drawCandidates(Canvas canvas) {
        for (int index = candidates.size() - 1; index >= 0; index--) {
            EngineLine line = candidates.get(index);
            if (line.pv.isEmpty()) continue;
            int[] point = line.pv.get(0);
            float cx = screenX(point[0]), cy = screenY(point[1]);
            paint.setStyle(Paint.Style.FILL); paint.setColor(index == 0 ? Color.rgb(42,145,87) : Color.rgb(57,112,189));
            canvas.drawCircle(cx, cy, dp(11), paint);
            paint.setColor(Color.WHITE); paint.setTextSize(dp(10)); paint.setTextAlign(Paint.Align.CENTER);
            canvas.drawText(String.valueOf(index + 1), cx, cy + dp(3.5f), paint);
        }
    }

    private void drawStones(Canvas canvas) {
        float radius = grid * .39f;
        for (int index = 0; index < stones.size(); index++) {
            Stone stone = stones.get(index);
            float cx = screenX(stone.x), cy = screenY(stone.y);
            int light = stone.player == 1 ? Color.rgb(80,80,77) : Color.WHITE;
            int dark = stone.player == 1 ? Color.rgb(5,7,7) : Color.rgb(205,201,191);
            paint.setShader(new RadialGradient(cx-radius*.3f, cy-radius*.35f, radius*1.4f, light, dark, Shader.TileMode.CLAMP));
            paint.setStyle(Paint.Style.FILL); canvas.drawCircle(cx, cy, radius, paint); paint.setShader(null);
            if (index == stones.size() - 1) { paint.setColor(Color.rgb(222,69,55)); canvas.drawCircle(cx, cy, dp(2.5f), paint); }
        }
    }

    private void drawPreview(Canvas canvas) {
        for (int i = 0; i < preview.size(); i++) {
            int[] point = preview.get(i);
            float cx = screenX(point[0]), cy = screenY(point[1]);
            int player = i % 2 == 0 ? previewFirstPlayer : (previewFirstPlayer == 1 ? 2 : 1);
            float radius = grid * .34f;
            int light = player == 1 ? Color.argb(205,80,80,77) : Color.argb(205,255,255,255);
            int dark = player == 1 ? Color.argb(205,5,7,7) : Color.argb(205,205,201,191);
            paint.setShader(new RadialGradient(cx-radius*.3f, cy-radius*.35f, radius*1.4f, light, dark, Shader.TileMode.CLAMP));
            paint.setStyle(Paint.Style.FILL); canvas.drawCircle(cx, cy, radius, paint); paint.setShader(null);
            paint.setStyle(Paint.Style.STROKE); paint.setStrokeWidth(dp(1.5f)); paint.setColor(Color.rgb(42,145,87)); canvas.drawCircle(cx, cy, radius, paint);
            paint.setStyle(Paint.Style.FILL); paint.setColor(player == 1 ? Color.WHITE : Color.rgb(35,35,33)); paint.setTextSize(dp(9)); paint.setTextAlign(Paint.Align.CENTER);
            String step = String.valueOf(i / 2 + 1);
            canvas.drawText(step, cx, cy + dp(3), paint);
        }
    }

    private float screenX(int logical) { return left + (flipped ? 14 - logical : logical) * grid; }
    private float screenY(int logical) { return top + (flipped ? 14 - logical : logical) * grid; }
    private float dp(float value) { return value * getResources().getDisplayMetrics().density; }

    @Override public boolean onTouchEvent(MotionEvent event) {
        if (event.getAction() != MotionEvent.ACTION_UP || grid <= 0) return true;
        int vx = Math.round((event.getX() - left) / grid), vy = Math.round((event.getY() - top) / grid);
        if (vx < 0 || vx > 14 || vy < 0 || vy > 14) return true;
        performClick();
        if (listener != null) listener.onPoint(flipped ? 14 - vx : vx, flipped ? 14 - vy : vy);
        return true;
    }
    @Override public boolean performClick() { super.performClick(); return true; }
}
