import type { AspectRatio } from "../types/project.js";
import { AspectRatioEnum } from "../types/project.js";
/**
 * Transform Vector2 to player view vector3
 *
 * @param x_2d
 * @param y_2d
 * @param distance
 * @param ratio
 * @returns Object {x: string, y: string, z: string} -> ^x ^y ^z
 */
function convert2DToLocal(
    x_2d: number,
    y_2d: number,
    distance?: number,
    ratio?: AspectRatio
): { x: string; y: string; z: string } {
    if (!distance) distance = 10;
    if (!ratio) ratio = AspectRatioEnum.ratio16v9;
    const Y_FACTOR = 0.700207538; // tan((FOV / 2) * PI / 180)
    let X_FACTOR: number = Y_FACTOR * (16 / 9);
    switch (ratio) {
        case AspectRatioEnum.ratio16v9:
            // X_FACTOR = Y_FACTOR * (16 / 9);
            break;
        case AspectRatioEnum.ratio16v10:
            X_FACTOR = Y_FACTOR * (16 / 10);
            break;
        case AspectRatioEnum.ratio21v9:
            X_FACTOR = Y_FACTOR * (21 / 9);
            break;
    }

    const localX: number = -x_2d * distance * X_FACTOR;
    const localY: number = y_2d * distance * Y_FACTOR;

    const localZ: number = distance;

    const format = (n: number) => n.toFixed(4);

    return { x: format(localX), y: format(localY), z: format(localZ) };
}
export default convert2DToLocal;
