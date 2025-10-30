/**
 * Transform Vector2 to player view vector3
 *
 * @param x_2d
 * @param y_2d
 * @param distance
 * @returns {x: number, y: number, z: number} -> ^x ^y ^z
 */
function convert2DToLocal(x_2d: number, y_2d: number, distance?: number): Object {
    if (!distance) distance = 10;
    const Y_FACTOR = 0.700207538;
    const X_FACTOR = Y_FACTOR * (16 / 9);

    const localX: number = -x_2d * distance * X_FACTOR;
    const localY: number = y_2d * distance * Y_FACTOR;

    const localZ: number = distance;

    const format = (n: number) => n.toFixed(4);

    return { x: localX, y: localY, z: localZ };
}

export default convert2DToLocal;
