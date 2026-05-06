

export interface Category {
  category_id: string;
  category_name: string;
  category_type: string;
  category_slug: string;
  icon: string;
  icon_color: string;
  created_at?: string;
  updated_at?: string;
}

export interface CategoryWithItems extends Category {
  items: string[];
  item_count: number;
  sort_order: number;
}

export interface CategoryType {
  value: string;
  label: string;
  icon: string;
}

export const CATEGORY_TYPES: CategoryType[] = [
  { value: 'vi-tri-cong-viec', label: 'Vị trí công việc', icon: '💼' },
  { value: 'cap-do-kinh-nghiem', label: 'Cấp độ kinh nghiệm', icon: '📊' },
  { value: 'phong-ban', label: 'Phòng ban', icon: '🏢' },
  { value: 'dia-diem-lam-viec', label: 'Địa điểm làm việc', icon: '📍' },
  { value: 'loai-hinh-cong-viec', label: 'Loại hình công việc', icon: '📋' },
  { value: 'ky-nang', label: 'Kỹ năng', icon: '🎯' },
  { value: 'nguon-ung-vien', label: 'Nguồn ứng viên', icon: '👥' },
  { value: 'loai-hinh-cong-ty', label: 'Loại hình công ty', icon: '🏢' },
  { value: 'truong-dai-hoc', label: 'Trường đại học', icon: '🎓' },
  { value: 'muc-do-uu-tien', label: 'Mức độ ưu tiên', icon: '⚡' }
];