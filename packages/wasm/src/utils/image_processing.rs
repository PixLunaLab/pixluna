use image::codecs::png::{CompressionType, FilterType, PngEncoder};
use image::{
    ColorType, DynamicImage, RgbaImage, imageops::flip_horizontal_in_place,
    imageops::flip_vertical_in_place,
};
use image::ImageEncoder; // for write_image on PngEncoder
use js_sys::Math;

fn map_compression(level: u8) -> CompressionType {
    match level {
        0..=3 => CompressionType::Fast,
        4..=6 => CompressionType::Default,
        _ => CompressionType::Best,
    }
}

fn encode_png(rgba: &RgbaImage, ct: CompressionType) -> Option<Vec<u8>> {
    let (w, h) = rgba.dimensions();
    let mut out = Vec::new();
    let encoder = PngEncoder::new_with_quality(&mut out, ct, FilterType::Adaptive);
    match encoder.write_image(rgba.as_raw(), w, h, ColorType::Rgba8.into()) {
        Ok(_) => Some(out),
        Err(_) => None,
    }
}

fn load_image(input: &[u8]) -> Option<DynamicImage> {
    image::load_from_memory(input).ok()
}

fn flip_in_place(rgba: &mut RgbaImage, mode: u8) {
    match mode {
        1 => flip_horizontal_in_place(rgba), // horizontal
        2 => flip_vertical_in_place(rgba),   // vertical
        3 => {
            flip_horizontal_in_place(rgba);
            flip_vertical_in_place(rgba);
        }
        _ => {}
    }
}

fn random_pixel_mutate(rgba: &mut RgbaImage) {
    let (w, h) = rgba.dimensions();
    if w == 0 || h == 0 {
        return;
    }
    let x = (Math::random() * w as f64).floor() as u32;
    let y = (Math::random() * h as f64).floor() as u32;
    let pixel = rgba.get_pixel_mut(x, y);
    for c in 0..3 {
        let v = pixel.0[c] as i16;
        let nv = if v + 1 <= 255 { v + 1 } else { v - 1 };
        pixel.0[c] = nv as u8;
    }
}

pub fn quality_image(input: &[u8], compression_level: u8) -> Vec<u8> {
    let Some(img) = load_image(input) else {
        return input.to_vec();
    };
    let rgba = img.to_rgba8();
    let ct = map_compression(compression_level);
    encode_png(&rgba, ct).unwrap_or_else(|| input.to_vec())
}

pub fn mix_image(input: &[u8], compression_level: u8) -> Vec<u8> {
    let Some(img) = load_image(input) else {
        return input.to_vec();
    };
    let mut rgba = img.to_rgba8();
    random_pixel_mutate(&mut rgba);
    let ct = map_compression(compression_level);
    encode_png(&rgba, ct).unwrap_or_else(|| input.to_vec())
}

pub fn process_image(
    input: &[u8],
    is_flip: bool,
    flip_mode: u8,   // 0 none, 1 horizontal, 2 vertical, 3 both
    confusion: bool, // chaos pixel mutate
    compress: bool,
    compression_level: u8,
    has_regular_url: bool,
) -> Vec<u8> {
    let Some(img) = load_image(input) else {
        return input.to_vec();
    };

    // Start from decoded image
    let mut rgba = img.to_rgba8();

    // Optional flip first (to match TS behavior order)
    if is_flip {
        flip_in_place(&mut rgba, flip_mode);
    }

    // Confusion: mutate one pixel
    if confusion {
        random_pixel_mutate(&mut rgba);
    }

    // Decide compression
    let ct = if compress && !has_regular_url {
        map_compression(compression_level)
    } else {
        CompressionType::Default
    };

    encode_png(&rgba, ct).unwrap_or_else(|| input.to_vec())
}
