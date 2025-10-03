// RestaurantApp/Converters/IntToBoolInverseConverter.cs
using System.Globalization;

namespace RestaurantApp.Converters
{
    public class IntToBoolInverseConverter : IValueConverter
    {
        public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
        {
            if (value is int intValue)
            {
                return intValue == 0;
            }
            return true;
        }

        public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
        {
            throw new NotImplementedException();
        }
    }
}