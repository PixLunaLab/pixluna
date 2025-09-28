use wasm_bindgen::prelude::*;

mod utils;

// Re-exported WASM bindings as the main entrypoints.
// Flip mode: 0 = none, 1 = horizontal, 2 = vertical, 3 = both
#[wasm_bindgen]
pub fn quality_image(input: &[u8], compression_level: u8) -> Vec<u8> {
    utils::image_processing::quality_image(input, compression_level)
}

#[wasm_bindgen]
pub fn mix_image(input: &[u8], compression_level: u8) -> Vec<u8> {
    utils::image_processing::mix_image(input, compression_level)
}

#[wasm_bindgen]
pub fn process_image(
    input: &[u8],
    is_flip: bool,
    flip_mode: u8,
    confusion: bool,
    compress: bool,
    compression_level: u8,
    has_regular_url: bool,
) -> Vec<u8> {
    utils::image_processing::process_image(
        input,
        is_flip,
        flip_mode,
        confusion,
        compress,
        compression_level,
        has_regular_url,
    )
}
